import { isDeepStrictEqual } from 'node:util';
import { VERSION_KEEP, type TipTapDoc } from '@note-app/shared';
import { AppError } from '../../common/errors/app-error.js';
import { contentTextOf } from '../notes/content-text.js';
import type { TransactionRepository } from '../notes/notes.repository.js';

export interface NoteState {
  title: string;
  content: TipTapDoc;
}

// One error for missing, not owned and trashed notes, so nothing reveals which (FR-X-1).
export const noteNotFound = () => new AppError('NOTE_NOT_FOUND', 'Note not found');

// JSON round trip drops undefined properties, which isDeepStrictEqual would otherwise see.
const plain = (content: unknown): unknown => JSON.parse(JSON.stringify(content));

export const sameState = (a: NoteState, b: NoteState): boolean =>
  a.title === b.title && isDeepStrictEqual(plain(a.content), plain(b.content));

// The save transaction of SDS 8.4 for PATCH and restore: lock the note row, let the caller decide
// the new state from the locked row, and when it differs update the note, insert the snapshot and
// drop versions beyond the newest VERSION_KEEP. An identical state writes nothing (AC-VER-02).
// Must run inside repository.transaction so a failure rolls everything back.
export const saveWithVersion = async (
  tx: TransactionRepository,
  userId: string,
  noteId: string,
  now: Date,
  decide: (current: NoteState) => Promise<NoteState> | NoteState,
) => {
  if (!(await tx.lockActiveByIdForUser(noteId, userId))) throw noteNotFound();
  const current = await tx.findActiveByIdForUser(noteId, userId);
  if (!current) throw noteNotFound();

  const currentState = { title: current.title, content: current.content as TipTapDoc };
  const next = await decide(currentState);
  if (sameState(currentState, next)) return current;

  const updated = await tx.updateActiveForUser(
    noteId,
    userId,
    { ...next, contentText: contentTextOf(next.content) },
    now,
  );
  if (!updated) throw noteNotFound();
  await tx.insertVersion(noteId, { versionNumber: updated.lastVersionNumber, ...next }, now);
  await tx.deleteVersionsUpTo(noteId, updated.lastVersionNumber - VERSION_KEEP);
  return updated;
};
