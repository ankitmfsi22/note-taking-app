import { describe, expect, it, vi } from 'vitest';
import type { TrashPurgeRepository } from '../modules/notes/notes.repository.js';
import { createTrashPurgeJob } from './trash-purge.job.js';

describe('createTrashPurgeJob', () => {
  it('deletes in batches until no expired note is left, with a cutoff of now minus 30 days', async () => {
    const batches = [['a', 'b'], ['c', 'd'], ['e']];
    const findExpiredIds = vi.fn(() => Promise.resolve(batches.shift() ?? []));
    const deleteExpired = vi.fn((ids: string[]) => Promise.resolve(ids.length));
    const repository: TrashPurgeRepository = { findExpiredIds, deleteExpired };

    const purged = await createTrashPurgeJob({ repository, batchSize: 2 }).run(
      new Date('2026-11-30T00:00:00.000Z'),
    );

    expect(purged).toBe(5);
    expect(deleteExpired).toHaveBeenCalledTimes(3);
    expect(findExpiredIds).toHaveBeenCalledWith(new Date('2026-10-31T00:00:00.000Z'), 2);
  });

  it('returns 0 when nothing has expired', async () => {
    const repository: TrashPurgeRepository = {
      findExpiredIds: () => Promise.resolve([]),
      deleteExpired: vi.fn(),
    };
    expect(await createTrashPurgeJob({ repository }).run(new Date())).toBe(0);
  });
});
