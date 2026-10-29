import {
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteResponseSchema,
  TagListResponseSchema,
  TagResponseSchema,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
const API = '/api/v1';

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;
const tagOf = (body: unknown) => TagResponseSchema.parse(body);
const noteOf = (body: unknown) => NoteResponseSchema.parse(body);

const userOf = async (app: Express) => {
  const { response } = await registerUser(app);
  const { accessToken } = AuthResponseSchema.parse(response.body);
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);
  return {
    listTags: () => auth(request(app).get(`${API}/tags`)),
    createTag: (body: unknown) =>
      auth(
        request(app)
          .post(`${API}/tags`)
          .send(body as object),
      ),
    updateTag: (id: string, body: unknown) =>
      auth(
        request(app)
          .patch(`${API}/tags/${id}`)
          .send(body as object),
      ),
    deleteTag: (id: string) => auth(request(app).delete(`${API}/tags/${id}`)),
    newTag: async (name: string) =>
      tagOf((await auth(request(app).post(`${API}/tags`).send({ name }))).body),
    createNote: async (title: string) =>
      noteOf((await auth(request(app).post(`${API}/notes`).send({ title }))).body),
    getNote: (id: string) => auth(request(app).get(`${API}/notes/${id}`)),
    deleteNote: (id: string) => auth(request(app).delete(`${API}/notes/${id}`)),
    setTags: (noteId: string, tagIds: unknown) =>
      auth(request(app).put(`${API}/notes/${noteId}/tags`).send({ tagIds })),
  };
};

const setup = async () => {
  const clock = createMutableClock(START);
  const { app } = createTestApp({ prisma, clock });
  return { app, clock, a: await userOf(app), b: await userOf(app) };
};

const tagRows = () => prisma.tag.count();
const noteTagRows = () => prisma.noteTag.count();

describe('tags', () => {
  it('rejects a name whose normalised key outgrows the column with 400, never 500', async () => {
    const { a } = await setup();
    const tag = await a.newTag('Plain');

    // Each '㎒' is one character but NFKC turns it into 'MHz', so 30 of them become 90.
    for (const response of [
      await a.createTag({ name: '㎒'.repeat(30) }),
      await a.updateTag(tag.id, { name: '㎒'.repeat(30) }),
    ]) {
      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
      expect(errorOf(response.body).details?.map((detail) => detail.field)).toContain('name');
    }
    expect(await tagRows()).toBe(1);
  });

  it('S-AB1006-01: create tags and list them with note counts that ignore soft-deleted notes', async () => {
    const { a, b } = await setup();
    const created = await a.createTag({ name: 'Work' });
    const other = await b.createTag({ name: 'Work', color: '#FF0000' });
    expect(created.status).toBe(201);
    expect(other.status).toBe(201);
    expect(tagOf(created.body)).toMatchObject({ name: 'Work', color: '#6B7280' });

    const notes = [await a.createNote('1'), await a.createNote('2'), await a.createNote('3')];
    for (const note of notes) {
      expect((await a.setTags(note.id, [tagOf(created.body).id])).status).toBe(200);
    }
    expect((await a.deleteNote(notes[2]?.id ?? '')).status).toBe(204);

    const list = await a.listTags();
    expect(list.status).toBe(200);
    const { items } = TagListResponseSchema.parse(list.body);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: tagOf(created.body).id, name: 'Work', noteCount: 2 });
  });

  it('S-AB1006-02: duplicate tag name in any letter case returns 409 TAG_NAME_TAKEN', async () => {
    const { a } = await setup();
    await a.newTag('Work');
    const home = await a.newTag('Home');

    const create = await a.createTag({ name: ' work ' });
    const rename = await a.updateTag(home.id, { name: 'WORK' });
    expect(create.status).toBe(409);
    expect(errorOf(create.body).code).toBe('TAG_NAME_TAKEN');
    expect(rename.status).toBe(409);
    expect(errorOf(rename.body).code).toBe('TAG_NAME_TAKEN');
    expect(await tagRows()).toBe(2);
    expect((await prisma.tag.findUniqueOrThrow({ where: { id: home.id } })).name).toBe('Home');
  });

  it('S-AB1006-03: invalid tag input returns 400 VALIDATION_ERROR and changes nothing', async () => {
    const { a } = await setup();
    const work = await a.newTag('Work');
    const note = await a.createNote('N');
    const tags = await Promise.all(Array.from({ length: 11 }, (_, i) => a.newTag(`t${i}`)));

    const cases = [
      { res: await a.createTag({ name: '   ' }), field: 'name' },
      { res: await a.createTag({ name: 'x'.repeat(31) }), field: 'name' },
      { res: await a.createTag({ name: 'Ok', color: 'red' }), field: 'color' },
      { res: await a.updateTag(work.id, {}), field: 'body' },
      {
        res: await a.setTags(
          note.id,
          tags.map((tag) => tag.id),
        ),
        field: 'tagIds',
      },
    ];
    for (const { res, field } of cases) {
      expect(res.status).toBe(400);
      const error = errorOf(res.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((detail) => detail.field)).toContain(field);
    }
    expect(await tagRows()).toBe(12);
    expect(await noteTagRows()).toBe(0);
  });

  it("S-AB1006-04: another user's tag or note returns 404 and a missing token returns 401", async () => {
    const { app, a, b } = await setup();
    const aTag = await a.newTag('Work');
    const aNote = await a.createNote('A');
    const bTag = await b.newTag('Mine');
    const bNote = await b.createNote('B');
    const bTrashed = await b.createNote('Trashed');
    await b.deleteNote(bTrashed.id);

    const patch = await b.updateTag(aTag.id, { name: 'X' });
    const del = await b.deleteTag(aTag.id);
    const foreignTag = await b.setTags(bNote.id, [aTag.id]);
    const foreignNote = await b.setTags(aNote.id, [bTag.id]);
    const trashed = await b.setTags(bTrashed.id, [bTag.id]);
    const anonymous = await request(app).get(`${API}/tags`);

    for (const res of [patch, del, foreignTag]) {
      expect(res.status).toBe(404);
      expect(errorOf(res.body).code).toBe('TAG_NOT_FOUND');
    }
    for (const res of [foreignNote, trashed]) {
      expect(res.status).toBe(404);
      expect(errorOf(res.body).code).toBe('NOTE_NOT_FOUND');
    }
    expect(anonymous.status).toBe(401);
    expect(errorOf(anonymous.body).code).toBe('UNAUTHORIZED');
    expect((await prisma.tag.findUniqueOrThrow({ where: { id: aTag.id } })).name).toBe('Work');
    expect(await noteTagRows()).toBe(0);
  });

  it('S-AB1006-05: rename and recolour show on notes, delete detaches without touching notes', async () => {
    const { a } = await setup();
    const work = await a.newTag('Work');
    const note = await a.createNote('N');
    await a.setTags(note.id, [work.id]);

    const patch = await a.updateTag(work.id, { name: 'Job', color: '#00aa00' });
    expect(patch.status).toBe(200);
    expect(tagOf(patch.body)).toMatchObject({ name: 'Job', color: '#00AA00' });
    const before = noteOf((await a.getNote(note.id)).body);
    expect(before.tags).toEqual([tagOf(patch.body)]);

    const del = await a.deleteTag(work.id);
    expect(del.status).toBe(204);
    const after = noteOf((await a.getNote(note.id)).body);
    expect(after.tags).toEqual([]);
    expect(after).toMatchObject({
      title: before.title,
      content: before.content,
      updatedAt: before.updatedAt,
    });
  });

  it('S-AB1006-06: setting note tags replaces the whole set in one transaction', async () => {
    const { a } = await setup();
    const home = await a.newTag('Home');
    const work = await a.newTag('Work');
    const ideas = await a.newTag('Ideas');
    const note = await a.createNote('N');
    await a.setTags(note.id, [home.id, work.id]);
    const before = noteOf((await a.getNote(note.id)).body);

    const first = await a.setTags(note.id, [work.id, ideas.id, ideas.id]);
    expect(first.status).toBe(200);
    const replaced = noteOf(first.body);
    expect(replaced.tags.map((tag) => tag.name)).toEqual(['Ideas', 'Work']);
    expect(replaced.updatedAt).toBe(before.updatedAt);

    const second = await a.setTags(note.id, []);
    expect(second.status).toBe(200);
    expect(noteOf(second.body).tags).toEqual([]);
  });

  it('returns the note tags on GET /notes/:id and lists none for an untagged note', async () => {
    const { a } = await setup();
    const work = await a.newTag('Work');
    const tagged = await a.createNote('T');
    const plain = await a.createNote('P');
    await a.setTags(tagged.id, [work.id]);
    expect(noteOf((await a.getNote(tagged.id)).body).tags.map((tag) => tag.id)).toEqual([work.id]);
    expect(noteOf((await a.getNote(plain.id)).body).tags).toEqual([]);
  });

  it('rejects a tag id that does not exist with 404 TAG_NOT_FOUND and keeps the old set', async () => {
    const { a } = await setup();
    const work = await a.newTag('Work');
    const note = await a.createNote('N');
    await a.setTags(note.id, [work.id]);
    const res = await a.setTags(note.id, ['0190b0a0-0000-7000-8000-000000000001']);
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('TAG_NOT_FOUND');
    expect(await noteTagRows()).toBe(1);
  });
});
