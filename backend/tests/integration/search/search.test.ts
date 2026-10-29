import {
  AuthResponseSchema,
  ErrorResponseSchema,
  NoteResponseSchema,
  SearchResponseSchema,
  type TipTapDoc,
} from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
const MINUTE_MS = 60 * 1000;

const docOf = (text: string): TipTapDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;

const tokenFor = async (app: Express) => {
  const { response } = await registerUser(app);
  return AuthResponseSchema.parse(response.body).accessToken;
};

const setup = async () => {
  const clock = createMutableClock(START);
  const { app } = createTestApp({ prisma, clock });
  const token = await tokenFor(app);
  const as = (accessToken: string) => ({
    create: async (title: string, text = '') =>
      NoteResponseSchema.parse(
        (
          await request(app)
            .post('/api/v1/notes')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ title, content: docOf(text) })
        ).body,
      ).id,
    rename: (id: string, title: string) =>
      request(app)
        .patch(`/api/v1/notes/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title }),
    remove: (id: string) =>
      request(app).delete(`/api/v1/notes/${id}`).set('Authorization', `Bearer ${accessToken}`),
    search: (query: string) =>
      request(app).get(`/api/v1/search?${query}`).set('Authorization', `Bearer ${accessToken}`),
  });
  return { app, clock, token, api: as(token), as };
};

describe('search', () => {
  it('S-AB1007-01: matching notes are returned ranked with pagination meta', async () => {
    const { clock, api } = await setup();
    const a = await api.create('Budget plan');
    clock.advanceMs(MINUTE_MS);
    const b = await api.create('Meeting', 'the budget was approved');
    clock.advanceMs(MINUTE_MS);
    const c = await api.create('Ideas');
    clock.advanceMs(MINUTE_MS);
    await api.rename(c, 'Budget review');

    const first = await api.search('q=budget&page=1&pageSize=2');
    expect(first.status).toBe(200);
    const page = SearchResponseSchema.parse(first.body);
    expect(page).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    // Title matches (weight A) outrank the content match; equal rank falls back to updatedAt desc.
    expect(page.items.map((item) => item.id)).toEqual([c, a]);
    expect(page.items[0]).toMatchObject({
      title: 'Budget review',
      titleHighlight: '<mark>Budget</mark> review',
      tags: [],
      updatedAt: clock.now().toISOString(),
    });
    expect(page.items[0]).toHaveProperty('snippet');

    const second = SearchResponseSchema.parse(
      (await api.search('q=budget&page=2&pageSize=2')).body,
    );
    expect(second.items.map((item) => item.id)).toEqual([b]);
    expect(second.items[0]?.snippet).toContain('<mark>budget</mark> was approved');
  });

  it('S-AB1007-02: HTML in note text is escaped and only mark tags are added', async () => {
    const { api } = await setup();
    await api.create('Plan <b>', `<script>alert(1)</script> plan & "q" 'x' <mark>fake</mark>`);

    const response = await api.search('q=plan');
    expect(response.status).toBe(200);
    const [item] = SearchResponseSchema.parse(response.body).items;
    expect(item?.titleHighlight).toBe('<mark>Plan</mark> &lt;b&gt;');
    const snippet = item?.snippet ?? '';
    for (const part of [
      '&lt;script&gt;',
      '&amp;',
      '&quot;',
      '&#39;',
      '&lt;mark&gt;fake&lt;/mark&gt;',
    ]) {
      expect(snippet).toContain(part);
    }
    const tags = (item?.titleHighlight + snippet).match(/<[^>]*>/g) ?? [];
    expect(tags.every((tag) => tag === '<mark>' || tag === '</mark>')).toBe(true);
    expect(snippet).toContain('<mark>plan</mark>');
  });

  it('S-AB1007-03: missing, too short, too long query or bad pagination returns 400 VALIDATION_ERROR', async () => {
    const { api } = await setup();
    const cases: [string, string][] = [
      ['', 'q'],
      ['q=%20a%20', 'q'],
      [`q=${'a'.repeat(201)}`, 'q'],
      ['q=budget&pageSize=101', 'pageSize'],
    ];
    for (const [query, field] of cases) {
      const response = await api.search(query);
      expect(response.status).toBe(400);
      const error = errorOf(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect((error.details ?? []).map((detail) => detail.field)).toContain(field);
    }
  });

  it('S-AB1007-04: operator syntax is treated as plain words', async () => {
    const { api } = await setup();
    await api.create('Notes', 'budget x');

    const response = await api.search(`q=${encodeURIComponent('budget & !(x:*) |')}`);
    expect(response.status).toBe(200);
    const [item] = SearchResponseSchema.parse(response.body).items;
    expect(item?.snippet).toBe('<mark>budget</mark> <mark>x</mark>');
    // Operator characters are ignored, never highlighted or a syntax error.
    expect(item?.snippet).not.toMatch(/<mark>[^<]*[&!():*|][^<]*<\/mark>/);
  });

  it('S-AB1007-05: other users and soft-deleted notes are never returned and no match gives an empty page', async () => {
    const { app, api, as } = await setup();
    const other = as(await tokenFor(app));
    await other.create('zebra');
    const trashed = await api.create('zebra');
    expect((await api.remove(trashed)).status).toBe(204);

    for (const q of ['zebra', 'the']) {
      const response = await api.search(`q=${q}`);
      expect(response.status).toBe(200);
      expect(SearchResponseSchema.parse(response.body)).toMatchObject({
        items: [],
        total: 0,
        totalPages: 0,
      });
    }
  });

  it('S-AB1007-06: search without a valid token returns 401 UNAUTHORIZED', async () => {
    const { app, clock, token } = await setup();
    clock.advanceMs(16 * MINUTE_MS);
    const responses = [
      await request(app).get('/api/v1/search?q=budget'),
      await request(app).get('/api/v1/search?q=budget').set('Authorization', `Bearer ${token}`),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(errorOf(response.body).code).toBe('UNAUTHORIZED');
    }
  });

  it('returns an empty page with correct totals beyond the last page', async () => {
    const { api } = await setup();
    await api.create('Budget one');

    const page = SearchResponseSchema.parse((await api.search('q=budget&page=5')).body);
    expect(page).toMatchObject({ items: [], page: 5, total: 1, totalPages: 1 });
  });

  it('keeps the search vector current when the content changes', async () => {
    const { api } = await setup();
    const id = await api.create('Plain title', 'apples');
    expect(SearchResponseSchema.parse((await api.search('q=oranges')).body).total).toBe(0);

    await prisma.note.update({ where: { id }, data: { contentText: 'oranges' } });
    expect(SearchResponseSchema.parse((await api.search('q=oranges')).body).total).toBe(1);
  });

  it('returns the note tags on each result, ordered by name', async () => {
    const { api } = await setup();
    const id = await api.create('Budget notes');
    await api.create('Budget untagged');
    const note = await prisma.note.findUniqueOrThrow({ where: { id } });
    const [zed, alpha] = await Promise.all(
      ['Zed', 'Alpha'].map((name) =>
        prisma.tag.create({ data: { userId: note.userId, name, nameKey: name.toLowerCase() } }),
      ),
    );
    await prisma.noteTag.createMany({
      data: [zed, alpha].map((tag) => ({ noteId: id, tagId: tag?.id ?? '' })),
    });

    const { items } = SearchResponseSchema.parse((await api.search('q=budget')).body);

    expect(items.find((item) => item.id === id)?.tags.map((tag) => tag.name)).toEqual([
      'Alpha',
      'Zed',
    ]);
    expect(items.find((item) => item.id !== id)?.tags).toEqual([]);
  });
});
