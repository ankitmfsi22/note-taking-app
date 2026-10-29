import { describe, expect, it } from 'vitest';
import { createNotesRepository } from '../../../src/modules/notes/notes.repository.js';
import { useTestDatabase } from '../../support/db.js';

const prisma = useTestDatabase();

const NOW = new Date('2026-10-29T09:00:00.000Z');
const DOC = { type: 'doc' as const, content: [] };

const createUser = () =>
  prisma.user.create({ data: { email: 'ada@example.com', passwordHash: 'x' } });

describe('notes repository', () => {
  it('updates content and contentText together and leaves the title alone', async () => {
    const repository = createNotesRepository(prisma);
    const user = await createUser();
    const note = await repository.createForUser(
      user.id,
      { title: 'Title', content: DOC, contentText: '' },
      NOW,
    );
    const content = { type: 'doc' as const, content: [{ type: 'paragraph' as const }] };

    const updated = await repository.updateActiveForUser(
      note.id,
      user.id,
      { content, contentText: '\n' },
      NOW,
    );

    expect(updated).toMatchObject({ title: 'Title', content, contentText: '\n' });
  });

  it('rethrows database errors other than a missing row', async () => {
    const repository = createNotesRepository(prisma);
    await expect(
      repository.updateActiveForUser('not-a-uuid', 'not-a-uuid', { title: 'x' }, NOW),
    ).rejects.toThrow();
  });
});
