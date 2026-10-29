import {
  ActiveShareLinkListResponseSchema,
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteResponseSchema,
  ShareLinkListResponseSchema,
  ShareLinkResponseSchema,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = new Date().toISOString();
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Shared text' }] }],
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
  const tokenA = await tokenFor(app);
  const tokenB = await tokenFor(app);
  const as = (token: string) => (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const apiFor = (token: string) => {
    const auth = as(token);
    return {
      createNote: async (title = 'Groceries') =>
        NoteResponseSchema.parse(
          (await auth(request(app).post('/api/v1/notes').send({ title, content: CONTENT }))).body,
        ),
      getNote: (id: string) => auth(request(app).get(`/api/v1/notes/${id}`)),
      removeNote: (id: string) => auth(request(app).delete(`/api/v1/notes/${id}`)),
      restoreNote: (id: string) => auth(request(app).post(`/api/v1/notes/${id}/restore`)),
      create: (noteId: string, body: object = {}) =>
        auth(request(app).post(`/api/v1/notes/${noteId}/shares`).send(body)),
      listForNote: (noteId: string) => auth(request(app).get(`/api/v1/notes/${noteId}/shares`)),
      listActive: () => auth(request(app).get('/api/v1/shares')),
      revoke: (shareId: string) => auth(request(app).post(`/api/v1/shares/${shareId}/revoke`)),
    };
  };
  const publicView = (token: string) => request(app).get(`/api/v1/public/shares/${token}`);
  const createLink = async (api: ReturnType<typeof apiFor>, noteId: string, body: object = {}) =>
    ShareLinkResponseSchema.parse((await api.create(noteId, body)).body);
  return { app, clock, a: apiFor(tokenA), b: apiFor(tokenB), publicView, createLink };
};

describe('share link owner endpoints', () => {
  it('S-AB1008-01: create two links for one note returns 201 with distinct unguessable tokens', async () => {
    const { clock, a } = await setup();
    const note = await a.createNote();

    const first = await a.create(note.id, {});
    const expiresAt = new Date(clock.now().getTime() + 7 * DAY_MS).toISOString();
    const second = await a.create(note.id, { expiresAt });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const [one, two] = [first, second].map((r) => ShareLinkResponseSchema.parse(r.body));
    for (const link of [one, two]) {
      expect(link).toMatchObject({
        noteId: note.id,
        status: 'active',
        viewCount: 0,
        revokedAt: null,
      });
      expect(link?.token).toMatch(TOKEN_PATTERN);
    }
    expect(one?.token).not.toBe(two?.token);
    expect(one?.expiresAt).toBeNull();
    expect(two?.expiresAt).toBe(expiresAt);
    expect(await prisma.shareLink.count({ where: { noteId: note.id } })).toBe(2);
  });

  it('S-AB1008-03: revoke is idempotent, leaves other links working and is reflected in the lists', async () => {
    const { a, publicView, createLink } = await setup();
    const note = await a.createNote();
    const linkA = await createLink(a, note.id);
    const linkB = await createLink(a, note.id);

    const firstRevoke = await a.revoke(linkA.id);
    const secondRevoke = await a.revoke(linkA.id);
    for (const response of [firstRevoke, secondRevoke]) {
      expect(response.status).toBe(200);
      expect(ShareLinkResponseSchema.parse(response.body).status).toBe('revoked');
    }
    expect(ShareLinkResponseSchema.parse(secondRevoke.body).revokedAt).toBe(
      ShareLinkResponseSchema.parse(firstRevoke.body).revokedAt,
    );

    const perNote = ShareLinkListResponseSchema.parse((await a.listForNote(note.id)).body);
    const statusOf = (id: string) => perNote.items.find((item) => item.id === id)?.status;
    expect(perNote.items).toHaveLength(2);
    expect(statusOf(linkA.id)).toBe('revoked');
    expect(statusOf(linkB.id)).toBe('active');

    const active = ActiveShareLinkListResponseSchema.parse((await a.listActive()).body);
    expect(active).toMatchObject({ page: 1, total: 1 });
    expect(active.items.map((item) => item.id)).toEqual([linkB.id]);
    expect(active.items[0]?.noteTitle).toBe('Groceries');

    expect((await publicView(linkB.token)).status).toBe(200);
  });

  it('S-AB1008-06: an invalid expiry or malformed parameter returns 400 VALIDATION_ERROR', async () => {
    const { clock, a, publicView } = await setup();
    const note = await a.createNote();
    const at = (ms: number) => new Date(clock.now().getTime() + ms).toISOString();

    const badExpiries = [at(-MINUTE_MS), 'not-a-date', at(366 * DAY_MS)];
    for (const expiresAt of badExpiries) {
      const response = await a.create(note.id, { expiresAt });
      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(response.body)).toEqual(['expiresAt']);
    }
    const revoke = await a.revoke('not-a-uuid');
    expect(revoke.status).toBe(400);
    expect(errorOf(revoke.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(revoke.body)).toEqual(['shareId']);
    const view = await publicView('short');
    expect(view.status).toBe(400);
    expect(errorOf(view.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(view.body)).toEqual(['token']);

    expect(await prisma.shareLink.count()).toBe(0);
  });

  it('S-AB1008-05: another user note or link returns 404 and a missing token returns 401', async () => {
    const { app, a, b } = await setup();
    const note = await a.createNote();
    const link = ShareLinkResponseSchema.parse((await a.create(note.id)).body);
    const deleted = await a.createNote('Gone');
    expect((await a.removeNote(deleted.id)).status).toBe(204);

    for (const response of [await b.create(note.id), await b.listForNote(note.id)]) {
      expect(response.status).toBe(404);
      expect(errorOf(response.body).code).toBe('NOTE_NOT_FOUND');
    }
    const foreignRevoke = await b.revoke(link.id);
    expect(foreignRevoke.status).toBe(404);
    expect(errorOf(foreignRevoke.body).code).toBe('SHARE_LINK_NOT_FOUND');
    const ownDeleted = await a.create(deleted.id);
    expect(ownDeleted.status).toBe(404);
    expect(errorOf(ownDeleted.body).code).toBe('NOTE_NOT_FOUND');

    const row = await prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.revokedAt).toBeNull();
    expect(await prisma.shareLink.count()).toBe(1);

    const anonymous = [
      request(app).post(`/api/v1/notes/${note.id}/shares`).send({}),
      request(app).get(`/api/v1/notes/${note.id}/shares`),
      request(app).get('/api/v1/shares'),
      request(app).post(`/api/v1/shares/${link.id}/revoke`),
    ];
    for (const pending of anonymous) {
      const response = await pending;
      expect(response.status).toBe(401);
      expect(errorOf(response.body).code).toBe('UNAUTHORIZED');
    }
  });
});
