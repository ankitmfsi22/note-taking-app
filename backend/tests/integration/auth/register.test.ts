import { AuthResponseSchema, ErrorResponseSchema } from '@note-app/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createPasswordHasher } from '../../../src/common/security/hash.js';
import { useTestDatabase } from '../../support/db.js';
import {
  createTestApp,
  refreshCookieOf,
  registerUser,
  TEST_PASSWORD,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;

const fieldsOf = (body: unknown): string[] =>
  (errorOf(body).details ?? []).map((detail) => detail.field);

const postRegister = (app: ReturnType<typeof createTestApp>['app'], body: object) =>
  request(app).post('/api/v1/auth/register').send(body);

describe('POST /api/v1/auth/register', () => {
  it('S-AB1002-01: register creates the user and logs them in', async () => {
    const { app } = createTestApp({ prisma });

    const { response } = await registerUser(app, {
      email: 'ada@example.com',
      displayName: 'Ada',
    });

    expect(response.status).toBe(201);
    const body = AuthResponseSchema.parse(response.body);
    expect(body.expiresIn).toBe(900);
    expect(body.user.displayName).toBe('Ada');
    expect(refreshCookieOf(response)).toMatch(/^refresh_token=.+/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(await prisma.user.count()).toBe(1);
    const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.revokedAt).toBeNull();
  });

  it('S-AB1002-02: register without a display name returns null', async () => {
    const { app } = createTestApp({ prisma });

    const { response } = await registerUser(app);

    expect(response.status).toBe(201);
    expect(AuthResponseSchema.parse(response.body).user.displayName).toBeNull();
  });

  it('S-AB1002-04: email is trimmed and stored in lower case', async () => {
    const { app } = createTestApp({ prisma });

    const { response } = await registerUser(app, { email: '  Ada.Lovelace@Example.COM ' });

    expect(response.status).toBe(201);
    expect(AuthResponseSchema.parse(response.body).user.email).toBe('ada.lovelace@example.com');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ADA.LOVELACE@example.com', password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('S-AB1002-05: duplicate email in any letter case returns 409 EMAIL_TAKEN', async () => {
    const { app } = createTestApp({ prisma });
    await registerUser(app, { email: 'ada@example.com' });

    const { response } = await registerUser(app, { email: 'ADA@Example.com' });

    expect(response.status).toBe(409);
    expect(errorOf(response.body).code).toBe('EMAIL_TAKEN');
    expect(await prisma.user.count({ where: { email: 'ada@example.com' } })).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it('S-AB1002-06: register with an invalid email returns 400 VALIDATION_ERROR', async () => {
    const { app } = createTestApp({ prisma });

    const response = await postRegister(app, { email: 'not-an-email', password: TEST_PASSWORD });

    expect(response.status).toBe(400);
    const error = errorOf(response.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((detail) => detail.field)).toContain('email');
    expect(await prisma.user.count()).toBe(0);
  });

  it('S-AB1002-07: register with a weak password returns 400 VALIDATION_ERROR', async () => {
    const { app } = createTestApp({ prisma });
    const passwords = ['short1', '12345678', 'abcdefgh', `a1${'x'.repeat(127)}`];

    for (const password of passwords) {
      const response = await postRegister(app, { email: 'ada@example.com', password });

      expect(response.status, `password of length ${password.length}`).toBe(400);
      const error = errorOf(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((detail) => detail.field)).toContain('password');
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it('S-AB1002-08: register with missing fields returns 400 VALIDATION_ERROR', async () => {
    const { app } = createTestApp({ prisma });

    const empty = await postRegister(app, {});
    const emptyName = await postRegister(app, {
      email: 'ada@example.com',
      password: TEST_PASSWORD,
      displayName: '',
    });

    expect(empty.status).toBe(400);
    expect(errorOf(empty.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(empty.body).sort()).toEqual(['email', 'password']);
    expect(emptyName.status).toBe(400);
    expect(errorOf(emptyName.body).code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(emptyName.body)).toEqual(['displayName']);
  });

  it('S-AB1002-09: password is stored as an Argon2id hash', async () => {
    const { app, env } = createTestApp({ prisma });

    await registerUser(app, { email: 'ada@example.com', password: TEST_PASSWORD });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(TEST_PASSWORD);
    const hasher = createPasswordHasher({
      memoryCost: env.ARGON2_MEMORY_KIB,
      timeCost: env.ARGON2_TIME_COST,
    });
    expect(await hasher.verify(user.passwordHash, TEST_PASSWORD)).toBe(true);
  });
});
