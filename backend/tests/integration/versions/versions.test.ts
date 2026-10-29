import {
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteResponseSchema,
  VersionDetailSchema,
  VersionListResponseSchema,
  VERSION_KEEP,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
const MINUTE_MS = 60 * 1000;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

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
  const as = (token: string) => {
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
    const base = '/api/v1/notes';
    return {
      create: (body: object) => auth(request(app).post(base).send(body)),
      patch: (id: string, body: object) => auth(request(app).patch(`${base}/${id}`).send(body)),
      remove: (id: string) => auth(request(app).delete(`${base}/${id}`)),
      restoreNote: (id: string) => auth(request(app).post(`${base}/${id}/restore`)),
      list: (id: string, query = '') => auth(request(app).get(`${base}/${id}/versions${query}`)),
      view: (id: string, n: number | string) =>
        auth(request(app).get(`${base}/${id}/versions/${n}`)),
      restore: (id: string, n: number | string) =>
        auth(request(app).post(`${base}/${id}/versions/${n}/restore`)),
    };
  };
  const api = as(tokenA);
  const createNote = async (title = 'A', text = 'one') =>
    NoteResponseSchema.parse((await api.create({ title, content: doc(text) })).body);
  // A note with versions 1 to 3: A/one, B/two, C/three.
  const noteWithThreeVersions = async () => {
    const note = await createNote('A', 'one');
    await api.patch(note.id, { title: 'B', content: doc('two') });
    await api.patch(note.id, { title: 'C', content: doc('three') });
    return note;
  };
  const tokenB = () => tokenFor(app);
  return { app, clock, api, as, tokenB, createNote, noteWithThreeVersions };
};

describe('version snapshots', () => {
  it('S-AB1009-01: a save creates a snapshot and an identical save creates none', async () => {
    const { clock, api } = await setup();

    const created = await api.create({ title: 'A', content: doc('one') });
    expect(created.status).toBe(201);
    const note = NoteResponseSchema.parse(created.body);
    expect(note.latestVersion).toBe(1);

    clock.advanceMs(MINUTE_MS);
    const first = await api.patch(note.id, { title: 'B', content: doc('two') });
    expect(first.status).toBe(200);
    const changed = NoteResponseSchema.parse(first.body);
    expect(changed.latestVersion).toBe(2);
    const v2 = await prisma.noteVersion.findUniqueOrThrow({
      where: { noteId_versionNumber: { noteId: note.id, versionNumber: 2 } },
    });
    expect(v2).toMatchObject({ title: 'B', content: doc('two') });

    clock.advanceMs(MINUTE_MS);
    const second = await api.patch(note.id, { title: 'B', content: doc('two') });
    expect(second.status).toBe(200);
    const same = NoteResponseSchema.parse(second.body);
    expect(same.latestVersion).toBe(2);
    expect(same.updatedAt).toBe(changed.updatedAt);
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(2);
  });

  it('S-AB1009-04: only the newest 50 versions are kept', async () => {
    const { api } = await setup();
    const note = await (async () => {
      const created = NoteResponseSchema.parse(
        (await api.create({ title: 'n0', content: doc('x') })).body,
      );
      for (let i = 1; i < VERSION_KEEP + 1; i += 1) {
        await api.patch(created.id, { title: `n${i}` });
      }
      return created;
    })();

    expect((await api.view(note.id, 1)).status).toBe(404);
    expect(errorOf((await api.view(note.id, 1)).body).code).toBe('VERSION_NOT_FOUND');
    const list = VersionListResponseSchema.parse((await api.list(note.id, '?pageSize=100')).body);
    expect(list.total).toBe(VERSION_KEEP);
    expect(list.items[0]?.versionNumber).toBe(51);
    expect(list.items.at(-1)?.versionNumber).toBe(2);

    const next = NoteResponseSchema.parse((await api.patch(note.id, { title: 'n51' })).body);
    expect(next.latestVersion).toBe(52);
    expect((await api.view(note.id, 2)).status).toBe(404);
    expect((await api.view(note.id, 3)).status).toBe(200);
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(VERSION_KEEP);
  }, 30_000);

  it('keeps a patch of only the title or only the content as a new version', async () => {
    const { api, createNote } = await setup();
    const note = await createNote('A', 'one');
    const titleOnly = await api.patch(note.id, { title: 'B' });
    expect(NoteResponseSchema.parse(titleOnly.body).latestVersion).toBe(2);
    const contentOnly = await api.patch(note.id, { content: doc('two') });
    expect(NoteResponseSchema.parse(contentOnly.body).latestVersion).toBe(3);
    const v3 = VersionDetailSchema.parse((await api.view(note.id, 3)).body);
    expect(v3).toMatchObject({ title: 'B', content: doc('two') });
  });
});

describe('list, view and restore', () => {
  it('S-AB1009-02: lists versions paginated newest first and views one', async () => {
    const { api, noteWithThreeVersions } = await setup();
    const note = await noteWithThreeVersions();

    const list = await api.list(note.id, '?page=1&pageSize=2');
    expect(list.status).toBe(200);
    const page = VersionListResponseSchema.parse(list.body);
    expect(page.items.map((item) => item.versionNumber)).toEqual([3, 2]);
    expect(page.items.map((item) => item.title)).toEqual(['C', 'B']);
    expect(page).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(JSON.stringify(list.body)).not.toContain('"content"');

    const detail = await api.view(note.id, 1);
    expect(detail.status).toBe(200);
    expect(VersionDetailSchema.parse(detail.body)).toMatchObject({
      versionNumber: 1,
      title: 'A',
      content: doc('one'),
    });

    const missing = await api.view(note.id, 9);
    expect(missing.status).toBe(404);
    expect(errorOf(missing.body).code).toBe('VERSION_NOT_FOUND');
  });

  it('returns the note tags when a version is restored', async () => {
    const { api, createNote } = await setup();
    const note = await createNote('A', 'one');
    const { userId } = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    const tag = await prisma.tag.create({ data: { userId, name: 'Work', nameKey: 'work' } });
    await prisma.noteTag.create({ data: { noteId: note.id, tagId: tag.id } });
    await api.patch(note.id, { title: 'B', content: doc('two') });

    const restored = NoteResponseSchema.parse((await api.restore(note.id, 1)).body);

    expect(restored.title).toBe('A');
    expect(restored.tags.map((item) => item.name)).toEqual(['Work']);
  });

  it('S-AB1009-03: restore creates a new version and updates the note', async () => {
    const { api, noteWithThreeVersions } = await setup();
    const note = await noteWithThreeVersions();

    const restored = await api.restore(note.id, 1);
    expect(restored.status).toBe(200);
    expect(NoteResponseSchema.parse(restored.body)).toMatchObject({
      title: 'A',
      content: doc('one'),
      latestVersion: 4,
    });
    const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.contentText).toBe('one\n');
    const titles = (await prisma.noteVersion.findMany({ orderBy: { versionNumber: 'asc' } })).map(
      (version) => version.title,
    );
    expect(titles).toEqual(['A', 'B', 'C', 'A']);

    const current = await api.restore(note.id, 4);
    expect(current.status).toBe(409);
    expect(errorOf(current.body).code).toBe('VERSION_ALREADY_CURRENT');
    // Version 1 is identical to the current note too (SA-20).
    expect((await api.restore(note.id, 1)).status).toBe(409);
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(4);

    await prisma.$executeRaw`
      CREATE FUNCTION ab1009_fail_insert() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql`;
    await prisma.$executeRaw`
      CREATE TRIGGER ab1009_fail BEFORE INSERT ON "NoteVersion"
      FOR EACH ROW EXECUTE FUNCTION ab1009_fail_insert()`;
    try {
      const failed = await api.restore(note.id, 2);
      expect(failed.status).toBe(500);
      expect(errorOf(failed.body).code).toBe('INTERNAL_ERROR');
    } finally {
      await prisma.$executeRaw`DROP TRIGGER ab1009_fail ON "NoteVersion"`;
      await prisma.$executeRaw`DROP FUNCTION ab1009_fail_insert()`;
    }
    const after = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after).toMatchObject({ title: 'A', lastVersionNumber: 4, contentText: 'one\n' });
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(4);
  });

  it('restores an older version that differs from the current note', async () => {
    const { api, noteWithThreeVersions } = await setup();
    const note = await noteWithThreeVersions();
    const restored = await api.restore(note.id, 2);
    expect(NoteResponseSchema.parse(restored.body)).toMatchObject({ title: 'B', latestVersion: 4 });
  });
});

describe('ownership, authentication and validation', () => {
  it('S-AB1009-05: another user, a deleted note and no token', async () => {
    const { app, as, api, tokenB, noteWithThreeVersions } = await setup();
    const note = await noteWithThreeVersions();
    const other = as(await tokenB());

    const calls = [other.list(note.id), other.view(note.id, 1), other.restore(note.id, 1)];
    for (const call of calls) {
      const response = await call;
      expect(response.status).toBe(404);
      expect(errorOf(response.body).code).toBe('NOTE_NOT_FOUND');
    }
    const untouched = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(untouched).toMatchObject({ title: 'C', lastVersionNumber: 3 });

    expect((await api.remove(note.id)).status).toBe(204);
    for (const call of [api.list(note.id), api.view(note.id, 1), api.restore(note.id, 1)]) {
      const response = await call;
      expect(response.status).toBe(404);
      expect(errorOf(response.body).code).toBe('NOTE_NOT_FOUND');
    }
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(3);

    const anonymous = await request(app).get(`/api/v1/notes/${note.id}/versions`);
    expect(anonymous.status).toBe(401);
    expect(errorOf(anonymous.body).code).toBe('UNAUTHORIZED');
  });

  it('keeps the versions of a deleted note and shows them again after it is restored', async () => {
    const { api, noteWithThreeVersions } = await setup();
    const note = await noteWithThreeVersions();
    await api.remove(note.id);
    expect((await api.restoreNote(note.id)).status).toBe(200);
    const page = VersionListResponseSchema.parse((await api.list(note.id)).body);
    expect(page.total).toBe(3);
  });

  it('S-AB1009-06: a malformed version number or pagination returns 400 VALIDATION_ERROR', async () => {
    const { api, createNote } = await setup();
    const note = await createNote();

    const checks: [Promise<request.Response>, string][] = [
      [api.list('not-a-uuid'), 'noteId'],
      [api.view(note.id, 0), 'versionNumber'],
      [api.restore(note.id, 'abc'), 'versionNumber'],
      [api.list(note.id, '?pageSize=101'), 'pageSize'],
    ];
    for (const [call, field] of checks) {
      const response = await call;
      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(response.body)).toContain(field);
    }
    expect(await prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });
});
