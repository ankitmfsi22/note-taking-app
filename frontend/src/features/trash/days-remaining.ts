import { TRASH_RETENTION_DAYS } from '@note-app/shared';

const DAY_MS = 86_400_000;

// The server's rule: a part of a day counts as a day, and the window never goes below 0.
export const daysRemaining = (deletedAt: string, now: Date): number => {
  const purgeAt = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / DAY_MS));
};
