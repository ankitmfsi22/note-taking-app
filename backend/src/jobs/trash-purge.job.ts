import type { TrashPurgeRepository } from '../modules/notes/notes.repository.js';
import { trashCutoff } from '../modules/notes/notes.service.js';

const BATCH_SIZE = 500;

// SDS 8.5: deletes notes with deletedAt <= now - 30 days in batches of 500, so each statement stays
// short. Cascades remove their children. Running it twice is harmless.
export const createTrashPurgeJob = ({
  repository,
  batchSize = BATCH_SIZE,
}: {
  repository: TrashPurgeRepository;
  batchSize?: number;
}) => ({
  run: async (now: Date): Promise<number> => {
    const cutoff = trashCutoff(now);
    let purged = 0;
    for (;;) {
      const ids = await repository.findExpiredIds(cutoff, batchSize);
      if (ids.length === 0) return purged;
      purged += await repository.deleteExpired(ids, cutoff);
      if (ids.length < batchSize) return purged;
    }
  },
});

export type TrashPurgeJob = ReturnType<typeof createTrashPurgeJob>;
