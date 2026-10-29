import { randomUUID } from 'node:crypto';
import {
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteResponseSchema,
  TrashListResponseSchema,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const CONTENT = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Milk' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'and eggs' }] },
  ],
};

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;
const fieldsOf = (body: unknown) => (errorOf(body).details ?? []).map((detail) => detail.field);

const tokenFor = async (app: Express) => {
  const { response } = await registerUser(app);
  return AuthResponseSchema.parse(response.body).accessToken;
};

const setup = async () => {
  const clock = createMutableClock(START);
  const { app } = createTestApp({ prisma, clock });
  const token = await tokenFor(app);
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const api = {
    create: (body: object) => auth(request(app).post('/api/v1/notes').send(body)),
    get: (id: string) => auth(request(app).get(`/api/v1/notes/${id}`)),
    patch: (id: string, body: object) => auth(request(app).patch(`/api/v1/notes/${id}`).send(body)),
    remove: (id: string) => auth(request(app).delete(`/api/v1/notes/${id}`)),
    trash: () => auth(request(app).get('/api/v1/notes/trash')),
    restore: (id: string) => auth(request(app).post(`/api/v1/notes/${id}/restore`)),
  };
  const createNote = async (title = 'Groceries') =>
    NoteResponseSchema.parse((await api.create({ title, content: CONTENT })).body);
  return { app, clock, token, api, createNote };
};

describe('notes CRUD', () => {
  it('S-AB1004-01: create, read and update an own note', async () => {
    const { clock, api } = await setup();

    const created = await api.create({ title: 'Groceries', content: CONTENT });
    expect(created.status).toBe(201);
    const note = NoteResponseSchema.parse(created.body);
    expect(note).toMatchObject({
      title: 'Groceries',
      content: CONTENT,
      tags: [],
      createdAt: START,
      updatedAt: START,
    });
    const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    const owner = await prisma.user.findFirstOrThrow();
    expect(row.userId).toBe(owner.id);
    expect(row.contentText).toBe('Milk\nand eggs\n');

    const read = await api.get(note.id);
    expect(read.status).toBe(200);
    expect(read.body).toEqual(note);

    clock.advanceMs(MINUTE_MS);
    const updated = await api.patch(note.id, { title: 'Shopping' });
    expect(updated.status).toBe(200);
    expect(NoteResponseSchema.parse(updated.body)).toMatchObject({
      id: note.id,
      title: 'Shopping',
      content: CONTENT,
      createdAt: START,
      updatedAt: clock.now().toISOString(),
    });
  });

  it('S-AB1004-02: invalid note input returns 400 VALIDATION_ERROR', async () => {
    const { api, createNote } = await setup();

    const blank = await api.create({ title: '   ' });
    expect(blank.status).toBe(400);
    expect(errorOf(blank.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(blank.body)).toEqual(['title']);
    expect(await prisma.note.count()).toBe(0);

    const note = await createNote();
    const before = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });

    const longTitle = await api.patch(note.id, { title: 'a'.repeat(201) });
    expect(longTitle.status).toBe(400);
    expect(errorOf(longTitle.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(longTitle.body)).toEqual(['title']);

    const big = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(512_000) }] }],
    };
    const bigContent = await api.patch(note.id, { content: big });
    expect(bigContent.status).toBe(400);
    expect(errorOf(bigContent.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(bigContent.body)).toEqual(['content']);

    expect(await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).toEqual(before);
  });

  it("S-AB1004-03: another user's or a missing note returns 404 NOTE_NOT_FOUND", async () => {
    const owner = await setup();
    const note = await owner.createNote();
    const trashed = await owner.createNote('Trashed');
    await owner.api.remove(trashed.id);
    const before = await prisma.note.findMany({ orderBy: { id: 'asc' } });

    const intruderToken = await tokenFor(owner.app);
    const as = (req: request.Test) => req.set('Authorization', `Bearer ${intruderToken}`);
    for (const id of [note.id, trashed.id, randomUUID()]) {
      const responses = await Promise.all([
        as(request(owner.app).get(`/api/v1/notes/${id}`)),
        as(request(owner.app).patch(`/api/v1/notes/${id}`).send({ title: 'Hacked' })),
        as(request(owner.app).delete(`/api/v1/notes/${id}`)),
        as(request(owner.app).post(`/api/v1/notes/${id}/restore`)),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(errorOf(response.body).code).toBe('NOTE_NOT_FOUND');
      }
    }

    expect(await prisma.note.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  it('S-AB1004-04: note operations without a valid token return 401, malformed id returns 400', async () => {
    const { app, clock, token } = await setup();
    const id = randomUUID();

    const anonymous = [
      request(app).post('/api/v1/notes').send({ title: 'x' }),
      request(app).get(`/api/v1/notes/${id}`),
      request(app).get('/api/v1/notes/trash'),
    ];
    clock.advanceMs(16 * MINUTE_MS);
    const expired = [
      request(app).post('/api/v1/notes').set('Authorization', `Bearer ${token}`).send({}),
      request(app).get(`/api/v1/notes/${id}`).set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/notes/trash').set('Authorization', `Bearer ${token}`),
    ];
    for (const response of await Promise.all([...anonymous, ...expired])) {
      expect(response.status).toBe(401);
      expect(errorOf(response.body).code).toBe('UNAUTHORIZED');
    }

    const freshToken = await tokenFor(app);
    const malformed = await request(app)
      .get('/api/v1/notes/not-a-uuid')
      .set('Authorization', `Bearer ${freshToken}`);
    expect(malformed.status).toBe(400);
    expect(errorOf(malformed.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(malformed.body)).toEqual(['noteId']);
  });

  it('S-AB1004-05: soft delete hides the note, lists it in trash and restore brings it back', async () => {
    const { clock, api, createNote } = await setup();
    const note = await createNote();
    clock.advanceMs(MINUTE_MS);
    const deletedAt = clock.now();

    const removed = await api.remove(note.id);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');
    const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.deletedAt).toEqual(deletedAt);
    expect(row.title).toBe(note.title);
    expect(row.content).toEqual(CONTENT);
    expect(row.updatedAt.toISOString()).toBe(note.updatedAt);

    clock.advanceMs(MINUTE_MS);
    for (const response of await Promise.all([
      api.get(note.id),
      api.patch(note.id, { title: 'Edited' }),
      api.remove(note.id),
    ])) {
      expect(response.status).toBe(404);
      expect(errorOf(response.body).code).toBe('NOTE_NOT_FOUND');
    }
    expect((await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).deletedAt).toEqual(
      deletedAt,
    );

    clock.advanceMs(-MINUTE_MS);
    const trash = await api.trash();
    expect(trash.status).toBe(200);
    expect(TrashListResponseSchema.parse(trash.body)).toEqual({
      items: [
        {
          id: note.id,
          title: 'Groceries',
          preview: 'Milk and eggs',
          deletedAt: deletedAt.toISOString(),
          purgeAt: new Date(deletedAt.getTime() + 30 * DAY_MS).toISOString(),
          daysRemaining: 30,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const restored = await api.restore(note.id);
    expect(restored.status).toBe(200);
    expect(NoteResponseSchema.parse(restored.body)).toEqual(note);
    const read = await api.get(note.id);
    expect(read.status).toBe(200);
    const after = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.deletedAt).toBeNull();
    expect(after.updatedAt.toISOString()).toBe(note.updatedAt);
  });
});
