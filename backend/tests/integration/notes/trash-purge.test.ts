import { AuthResponseSchema, ErrorResponseSchema, NoteResponseSchema } from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTrashPurgeJob } from '../../../src/jobs/trash-purge.job.js';
import { createTrashPurgeRepository } from '../../../src/modules/notes/notes.repository.js';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const START = '2026-10-29T09:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

const login = async (app: Express, credentials: { email: string; password: string }) =>
  AuthResponseSchema.parse((await request(app).post('/api/v1/auth/login').send(credentials)).body)
    .accessToken;

const setup = async () => {
  const clock = createMutableClock(START);
  const { app } = createTestApp({ prisma, clock });
  const { credentials } = await registerUser(app);
  let token = await login(app, credentials);
  const as = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    app,
    clock,
    relogin: async () => {
      token = await login(app, credentials);
    },
    create: async (title: string) =>
      NoteResponseSchema.parse((await as(request(app).post('/api/v1/notes').send({ title }))).body),
    remove: (id: string) => as(request(app).delete(`/api/v1/notes/${id}`)),
    restore: (id: string) => as(request(app).post(`/api/v1/notes/${id}/restore`)),
  };
};

describe('trash purge', () => {
  it('S-AB1004-06: restore and purge at the 30-day boundary', async () => {
    const api = await setup();
    const x = await api.create('X');
    const y = await api.create('Y');
    const active = await api.create('Active');

    expect((await api.remove(y.id)).status).toBe(204);
    api.clock.advanceMs(1000);
    expect((await api.remove(x.id)).status).toBe(204);

    // now = Y deleted exactly 30 days ago, X deleted 30 days minus one second ago.
    api.clock.advanceMs(30 * DAY_MS - 1000);
    const purged = await createTrashPurgeJob({
      repository: createTrashPurgeRepository(prisma),
    }).run(api.clock.now());

    expect(purged).toBe(1);
    expect(await prisma.note.findUnique({ where: { id: y.id } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: x.id } })).not.toBeNull();
    expect(await prisma.note.findUnique({ where: { id: active.id } })).not.toBeNull();

    await api.relogin();
    expect((await api.restore(x.id)).status).toBe(200);
    const missing = await api.restore(y.id);
    expect(missing.status).toBe(404);
    expect(ErrorResponseSchema.parse(missing.body).error.code).toBe('NOTE_NOT_FOUND');
  });
});
