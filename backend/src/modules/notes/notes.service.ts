import {
  TRASH_RETENTION_DAYS,
  type NoteCreateRequest,
  type NoteListQuery,
  type NoteUpdateRequest,
  type PaginationQuery,
  type TipTapDoc,
} from '@note-app/shared';
import type { Clock } from '../../common/clock.js';
import { AppError } from '../../common/errors/app-error.js';
import { contentTextOf, previewOf } from './content-text.js';
import { saveWithVersion } from '../versions/save-with-version.js';
import type { NotesRepository } from './notes.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

// One error for missing, not owned, trashed and expired notes, so nothing reveals which (FR-X-1).
const noteNotFound = () => new AppError('NOTE_NOT_FOUND', 'Note not found');

// Restorable while deletedAt > cutoff; the purge removes deletedAt <= cutoff (ADR-0005).
export const trashCutoff = (now: Date): Date => new Date(now.getTime() - RETENTION_MS);

// contentText is always derived here, never taken from the client (SDS 8.1).
const contentFields = (content: TipTapDoc) => ({ content, contentText: contentTextOf(content) });

export const createNotesService = ({
  repository,
  clock,
}: {
  repository: NotesRepository;
  clock: Clock;
}) => ({
  create: (userId: string, { title, content }: NoteCreateRequest) =>
    repository.createForUser(userId, { title, ...contentFields(content) }, clock.now()),

  get: async (userId: string, noteId: string) => {
    const note = await repository.findActiveByIdForUser(noteId, userId);
    if (!note) throw noteNotFound();
    return note;
  },

  update: (userId: string, noteId: string, { title, content }: NoteUpdateRequest) =>
    repository.transaction((tx) =>
      saveWithVersion(tx, userId, noteId, clock.now(), (current) => ({
        title: title ?? current.title,
        content: content ?? current.content,
      })),
    ),

  remove: async (userId: string, noteId: string): Promise<void> => {
    const now = clock.now();
    const deleted = await repository.transaction(async (tx) => {
      const note = await tx.findActiveByIdForUser(noteId, userId);
      return note ? tx.markDeleted(noteId, userId, now, note.updatedAt) : 0;
    });
    if (deleted === 0) throw noteNotFound();
  },

  restore: async (userId: string, noteId: string) => {
    const cutoff = trashCutoff(clock.now());
    const note = await repository.transaction(async (tx) => {
      const trashed = await tx.findTrashedByIdForUser(noteId, userId, cutoff);
      if (!trashed) return null;
      await tx.markRestored(noteId, userId, cutoff, trashed.updatedAt);
      return tx.findActiveByIdForUser(noteId, userId);
    });
    if (!note) throw noteNotFound();
    return note;
  },

  list: async (userId: string, { page, pageSize, sortBy, sortOrder, tagIds }: NoteListQuery) => {
    // One error whether a tag is missing or another user's (AC-LIST-08, FR-X-1).
    if (
      tagIds !== undefined &&
      (await repository.countTagsForUser(userId, tagIds)) < tagIds.length
    ) {
      throw new AppError('TAG_NOT_FOUND', 'Tag not found');
    }
    const { items, total } = await repository.listActiveForUser(userId, {
      sortBy,
      sortOrder,
      tagIds,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map(({ contentText, ...item }) => ({
        ...item,
        preview: previewOf(contentText),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  listTrash: async (userId: string, { page, pageSize }: PaginationQuery) => {
    const now = clock.now();
    const { items, total } = await repository.listTrashedForUser(userId, trashCutoff(now), {
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map(({ id, title, contentText, deletedAt }) => {
        const purgeAt = new Date(deletedAt.getTime() + RETENTION_MS);
        return {
          id,
          title,
          preview: previewOf(contentText),
          deletedAt,
          purgeAt,
          daysRemaining: Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / DAY_MS)),
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },
});

export type NotesService = ReturnType<typeof createNotesService>;
