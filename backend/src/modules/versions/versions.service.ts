import type { PaginationQuery, TipTapDoc } from '@note-app/shared';
import type { Clock } from '../../common/clock.js';
import { AppError } from '../../common/errors/app-error.js';
import type { NotesRepository } from '../notes/notes.repository.js';
import { noteNotFound, saveWithVersion, sameState } from './save-with-version.js';
import type { VersionsRepository } from './versions.repository.js';

const versionNotFound = () => new AppError('VERSION_NOT_FOUND', 'Version not found');

export const createVersionsService = ({
  notesRepository,
  versionsRepository,
  clock,
}: {
  notesRepository: NotesRepository;
  versionsRepository: VersionsRepository;
  clock: Clock;
}) => ({
  list: async (userId: string, noteId: string, { page, pageSize }: PaginationQuery) => {
    if (!(await notesRepository.findActiveByIdForUser(noteId, userId))) throw noteNotFound();
    const { items, total } = await versionsRepository.listVersionsForUser(noteId, userId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },

  get: async (userId: string, noteId: string, versionNumber: number) => {
    if (!(await notesRepository.findActiveByIdForUser(noteId, userId))) throw noteNotFound();
    const version = await versionsRepository.findVersionForUser(noteId, userId, versionNumber);
    if (!version) throw versionNotFound();
    return version;
  },

  // Restore is a save: the target becomes a new latest version, older ones stay untouched.
  restore: (userId: string, noteId: string, versionNumber: number) =>
    notesRepository.transaction((tx) =>
      saveWithVersion(tx, userId, noteId, clock.now(), async (current) => {
        const version = await tx.findVersionForUser(noteId, userId, versionNumber);
        if (!version) throw versionNotFound();
        const target = { title: version.title, content: version.content as TipTapDoc };
        if (sameState(current, target)) {
          throw new AppError('VERSION_ALREADY_CURRENT', 'Version equals the current note');
        }
        return target;
      }),
    ),
});

export type VersionsService = ReturnType<typeof createVersionsService>;
