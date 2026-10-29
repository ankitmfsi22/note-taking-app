import {
  TAG_COLOR_DEFAULT,
  TAG_NAME_MAX,
  type TagCreateRequest,
  type TagUpdateRequest,
} from '@note-app/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { TagsRepository } from './tags.repository.js';

// One error for missing and not-owned tags (FR-X-1).
const tagNotFound = () => new AppError('TAG_NOT_FOUND', 'Tag not found');
const nameTaken = () => new AppError('TAG_NAME_TAKEN', 'A tag with this name already exists');

// SDS 7.3: the name is already trimmed by the schema.
export const nameKeyOf = (name: string): string => name.trim().normalize('NFKC').toLowerCase();

// NFKC can lengthen a valid name ('㎒' becomes 'mhz'). A key wider than the VarChar(30) column is
// a validation error, not a database failure. Spread counts code points, as PostgreSQL does.
const checkedNameKey = (name: string): string => {
  const nameKey = nameKeyOf(name);
  if ([...nameKey].length > TAG_NAME_MAX) {
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', [
      { field: 'name', message: `Name must be at most ${TAG_NAME_MAX} characters once normalised` },
    ]);
  }
  return nameKey;
};

export const createTagsService = ({ repository }: { repository: TagsRepository }) => ({
  create: async (userId: string, { name, color }: TagCreateRequest) => {
    const tag = await repository.createForUser(userId, {
      name,
      nameKey: checkedNameKey(name),
      color: (color ?? TAG_COLOR_DEFAULT).toUpperCase(),
    });
    if (!tag) throw nameTaken();
    return tag;
  },

  list: (userId: string) => repository.listWithCountForUser(userId),

  update: async (userId: string, tagId: string, { name, color }: TagUpdateRequest) => {
    const result = await repository.updateForUser(tagId, userId, {
      name,
      nameKey: name === undefined ? undefined : checkedNameKey(name),
      color: color?.toUpperCase(),
    });
    if (result === 'missing') throw tagNotFound();
    if (result === 'taken') throw nameTaken();
    return result;
  },

  remove: async (userId: string, tagId: string): Promise<void> => {
    if ((await repository.deleteForUser(tagId, userId)) === 0) throw tagNotFound();
  },

  // The note is checked before the tags (spec). One transaction, so a failure keeps the old set.
  setNoteTags: (userId: string, noteId: string, tagIds: string[]) =>
    repository.transaction(async (tx) => {
      if (!(await tx.findActiveNoteForUser(noteId, userId))) {
        throw new AppError('NOTE_NOT_FOUND', 'Note not found');
      }
      if ((await tx.countForUser(userId, tagIds)) < tagIds.length) throw tagNotFound();
      await tx.replaceNoteTags(noteId, tagIds);
      const note = await tx.findNoteWithTagsForUser(noteId, userId);
      if (!note) throw new AppError('NOTE_NOT_FOUND', 'Note not found');
      return note;
    }),
});

export type TagsService = ReturnType<typeof createTagsService>;
