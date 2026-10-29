import {
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteListResponseSchema,
  NoteResponseSchema,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
// Small enough that 25 notes stay inside the 15-minute access token lifetime.
const STEP_MS = 1000;

const CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milk   and\neggs' }] }],
};

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;
const listOf = (body: unknown) => NoteListResponseSchema.parse(body);
const idsOf = (body: unknown) => listOf(body).items.map((item) => item.id);

const userOf = async (app: Express, clock: ReturnType<typeof createMutableClock>) => {
  const { response } = await registerUser(app);
  const { accessToken, user } = AuthResponseSchema.parse(response.body);
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);
  const list = (query = '') => auth(request(app).get(`/api/v1/notes${query}`));
  const remove = (id: string) => auth(request(app).delete(`/api/v1/notes/${id}`));
  // Each note is a second newer than the last, so updatedAt order is known.
  const createNote = async (title: string) => {
    clock.advanceMs(STEP_MS);
    const response = await auth(
      request(app).post('/api/v1/notes').send({ title, content: CONTENT }),
    );
    return NoteResponseSchema.parse(response.body);
  };
  const createTag = (name: string) =>
    prisma.tag.create({ data: { userId: user.id, name, nameKey: name.toLowerCase() } });
  return { userId: user.id, list, remove, createNote, createTag };
};

const setup = async () => {
  const clock = createMutableClock(START);
  const { app } = createTestApp({ prisma, clock });
  return { app, clock, user: await userOf(app, clock) };
};

const tagNote = (noteId: string, tagId: string) =>
  prisma.noteTag.create({ data: { noteId, tagId } });

describe('GET /notes', () => {
  it('S-AB1005-01: default list returns the first page with pagination meta', async () => {
    const { user } = await setup();
    const notes = [];
    for (let i = 1; i <= 25; i += 1) notes.push(await user.createNote(`Note ${i}`));

    const first = await user.list();
    expect(first.status).toBe(200);
    const page = listOf(first.body);
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 25, totalPages: 2 });
    expect(page.items.map((item) => item.id)).toEqual(
      notes
        .slice(5)
        .reverse()
        .map((note) => note.id),
    );
    const newest = notes[24];
    expect(page.items[0]).toEqual({
      id: newest?.id,
      title: 'Note 25',
      preview: 'Milk and eggs',
      tags: [],
      createdAt: newest?.createdAt,
      updatedAt: newest?.updatedAt,
    });

    const beyond = await user.list('?page=4');
    expect(beyond.status).toBe(200);
    expect(listOf(beyond.body)).toMatchObject({
      items: [],
      page: 4,
      pageSize: 20,
      total: 25,
      totalPages: 2,
    });
  });

  it('S-AB1005-02: sort by title ascending breaks ties by id', async () => {
    const { user } = await setup();
    const b = await user.createNote('b');
    const a1 = await user.createNote('a');
    const a2 = await user.createNote('a');
    const [low, high] = [a1.id, a2.id].sort();

    const response = await user.list('?sortBy=title&sortOrder=asc');
    expect(response.status).toBe(200);
    expect(idsOf(response.body)).toEqual([low, high, b.id]);
  });

  it('S-AB1005-03: invalid query parameters return 400 VALIDATION_ERROR', async () => {
    const { user } = await setup();
    const cases = [
      ['pageSize=101', 'pageSize'],
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['sortBy=color', 'sortBy'],
      ['sortOrder=up', 'sortOrder'],
      ['tagIds=not-a-uuid', 'tagIds'],
    ] as const;
    for (const [query, field] of cases) {
      const response = await user.list(`?${query}`);
      expect(response.status, query).toBe(400);
      const error = errorOf(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(
        (error.details ?? []).some((detail) => detail.field.split('.')[0] === field),
        query,
      ).toBe(true);
    }
  });

  it('S-AB1005-04: no token returns 401 and other users notes are never listed', async () => {
    const { app, clock, user: a } = await setup();
    const anonymous = await request(app).get('/api/v1/notes');
    expect(anonymous.status).toBe(401);
    expect(errorOf(anonymous.body).code).toBe('UNAUTHORIZED');

    const b = await userOf(app, clock);
    const own = [await a.createNote('A1'), await a.createNote('A2')];
    for (const title of ['B1', 'B2', 'B3']) await b.createNote(title);

    const response = await a.list();
    expect(response.status).toBe(200);
    expect(listOf(response.body).total).toBe(2);
    expect(idsOf(response.body).sort()).toEqual(own.map((note) => note.id).sort());
  });

  it('S-AB1005-05: soft-deleted notes are excluded from items and totals', async () => {
    const { user } = await setup();
    const notes = [
      await user.createNote('One'),
      await user.createNote('Two'),
      await user.createNote('Three'),
    ];
    const deleted = notes[1]?.id ?? '';
    expect((await user.remove(deleted)).status).toBe(204);

    const response = await user.list();
    expect(response.status).toBe(200);
    expect(listOf(response.body)).toMatchObject({ total: 2, totalPages: 1 });
    expect(idsOf(response.body)).toHaveLength(2);
    expect(idsOf(response.body)).not.toContain(deleted);
  });

  it('S-AB1005-06: tag filter matches any tag once and rejects a foreign tag', async () => {
    const { app, clock, user } = await setup();
    const t1 = await user.createTag('Alpha');
    const t2 = await user.createTag('Beta');
    const n1 = await user.createNote('N1');
    const n2 = await user.createNote('N2');
    await user.createNote('N3');
    await tagNote(n1.id, t1.id);
    await tagNote(n1.id, t2.id);
    await tagNote(n2.id, t2.id);

    const response = await user.list(`?tagIds=${t1.id},${t2.id}`);
    expect(response.status).toBe(200);
    const page = listOf(response.body);
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.id)).toEqual([n2.id, n1.id]);
    expect(page.items[1]?.tags.map((tag) => tag.name)).toEqual(['Alpha', 'Beta']);
    expect(page.items[1]?.tags[0]).toEqual({
      id: t1.id,
      name: 'Alpha',
      color: '#6B7280',
      createdAt: t1.createdAt.toISOString(),
    });

    const other = await userOf(app, clock);
    const foreign = await other.createTag('Mine');
    const rejected = await user.list(`?tagIds=${t1.id},${foreign.id}`);
    expect(rejected.status).toBe(404);
    expect(errorOf(rejected.body).code).toBe('TAG_NOT_FOUND');
  });

  it('excludes soft-deleted notes under a tag filter and keeps pages disjoint', async () => {
    const { user } = await setup();
    const tag = await user.createTag('Work');
    const notes = [];
    for (let i = 1; i <= 3; i += 1) {
      const note = await user.createNote('same');
      await tagNote(note.id, tag.id);
      notes.push(note);
    }
    expect((await user.remove(notes[0]?.id ?? '')).status).toBe(204);

    const query = `?tagIds=${tag.id}&sortBy=title&sortOrder=desc&pageSize=1`;
    const first = await user.list(query);
    const second = await user.list(`${query}&page=2`);
    expect(listOf(first.body)).toMatchObject({ total: 2, totalPages: 2 });
    expect([...idsOf(first.body), ...idsOf(second.body)]).toEqual(
      [notes[1]?.id, notes[2]?.id].sort().reverse(),
    );
  });

  it('sorts by createdAt ascending', async () => {
    const { user } = await setup();
    const first = await user.createNote('x');
    const second = await user.createNote('y');
    const response = await user.list('?sortBy=createdAt&sortOrder=asc');
    expect(idsOf(response.body)).toEqual([first.id, second.id]);
  });
});
