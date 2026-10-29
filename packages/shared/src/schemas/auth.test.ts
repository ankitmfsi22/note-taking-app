import { describe, expect, it } from 'vitest';
import {
  AuthResponseSchema,
  EmailSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  NewPasswordSchema,
  PublicUserSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from './auth.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const CREATED_AT = '2026-10-28T10:00:00.000Z';

describe('EmailSchema', () => {
  it('trims and lower-cases a valid email', () => {
    expect(EmailSchema.parse('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('rejects a string that is not an email', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('accepts an email of 254 characters', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    expect(email).toHaveLength(254);
    expect(EmailSchema.safeParse(email).success).toBe(true);
  });

  it('rejects an email longer than 254 characters', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`;
    expect(email).toHaveLength(255);
    expect(EmailSchema.safeParse(email).success).toBe(false);
  });
});

describe('RegisterRequestSchema', () => {
  const valid = { email: 'ada@example.com', password: 'abcdefg1' };

  it('accepts a valid body without displayName', () => {
    expect(RegisterRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('normalises the email', () => {
    const result = RegisterRequestSchema.parse({ ...valid, email: ' Ada@Example.com ' });
    expect(result.email).toBe('ada@example.com');
  });

  it('accepts passwords of 8 and 128 characters', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password: 'abcdefg1' }).success).toBe(true);
    const long = `${'a'.repeat(127)}1`;
    expect(RegisterRequestSchema.safeParse({ ...valid, password: long }).success).toBe(true);
  });

  it.each([
    ['too short', 'short1'],
    ['digits only', '12345678'],
    ['letters only', 'abcdefgh'],
    ['129 characters', `${'a'.repeat(128)}1`],
  ])('rejects a password that is %s', (_name, password) => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password }).success).toBe(false);
  });

  it('accepts a non-ASCII letter as the letter', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password: 'éééééééé1' }).success).toBe(true);
  });

  it('trims displayName', () => {
    const result = RegisterRequestSchema.parse({ ...valid, displayName: '  Ada  ' });
    expect(result.displayName).toBe('Ada');
  });

  it('accepts a displayName of 100 characters', () => {
    const displayName = 'a'.repeat(100);
    expect(RegisterRequestSchema.safeParse({ ...valid, displayName }).success).toBe(true);
  });

  it('rejects an empty or blank displayName', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, displayName: '' }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...valid, displayName: '   ' }).success).toBe(false);
  });

  it('rejects a displayName longer than 100 characters', () => {
    const displayName = 'a'.repeat(101);
    expect(RegisterRequestSchema.safeParse({ ...valid, displayName }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });
});

describe('LoginRequestSchema', () => {
  it('accepts any non-empty password without a strength rule', () => {
    const result = LoginRequestSchema.safeParse({ email: 'Ada@Example.com', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ada@example.com');
  });

  it('rejects an empty password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'ada@example.com', password: '' }).success).toBe(
      false,
    );
  });

  it('accepts 128 characters and rejects 129', () => {
    const email = 'ada@example.com';
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(128) }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email, password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(LoginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('PublicUserSchema', () => {
  const user = { id: ID, email: 'ada@example.com', displayName: 'Ada', createdAt: CREATED_AT };

  it('accepts displayName as a string or null', () => {
    expect(PublicUserSchema.safeParse(user).success).toBe(true);
    expect(PublicUserSchema.safeParse({ ...user, displayName: null }).success).toBe(true);
  });

  it('rejects a missing displayName', () => {
    const { displayName: _omit, ...rest } = user;
    expect(PublicUserSchema.safeParse(rest).success).toBe(false);
  });
});

describe('AuthResponseSchema', () => {
  const body = {
    user: { id: ID, email: 'ada@example.com', displayName: null, createdAt: CREATED_AT },
    accessToken: 'jwt',
    expiresIn: 900,
  };

  it('accepts a valid response', () => {
    expect(AuthResponseSchema.safeParse(body).success).toBe(true);
  });

  it('strips unknown keys such as passwordHash on user', () => {
    const result = AuthResponseSchema.parse({
      ...body,
      user: { ...body.user, passwordHash: 'secret' },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('requires expiresIn to be 900', () => {
    expect(AuthResponseSchema.safeParse({ ...body, expiresIn: 60 }).success).toBe(false);
  });
});

describe('NewPasswordSchema', () => {
  it('accepts 8 and 128 characters with a letter and a digit', () => {
    expect(NewPasswordSchema.safeParse('abcdefg1').success).toBe(true);
    expect(NewPasswordSchema.safeParse(`${'a'.repeat(127)}1`).success).toBe(true);
  });

  it.each([
    ['too short', 'short1'],
    ['digits only', '12345678'],
    ['letters only', 'abcdefgh'],
    ['129 characters', `${'a'.repeat(128)}1`],
  ])('rejects a password that is %s', (_name, password) => {
    expect(NewPasswordSchema.safeParse(password).success).toBe(false);
  });
});

describe('ForgotPasswordRequestSchema', () => {
  it('trims and lower-cases a valid email', () => {
    const result = ForgotPasswordRequestSchema.parse({ email: '  Ada@Example.COM ' });
    expect(result.email).toBe('ada@example.com');
  });

  it('accepts an email of 254 characters and rejects 255', () => {
    const at254 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    const at255 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`;
    expect(ForgotPasswordRequestSchema.safeParse({ email: at254 }).success).toBe(true);
    expect(ForgotPasswordRequestSchema.safeParse({ email: at255 }).success).toBe(false);
  });

  it('rejects a malformed email and names the email field', () => {
    const result = ForgotPasswordRequestSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['email']);
  });

  it('rejects a missing email', () => {
    expect(ForgotPasswordRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('ResetPasswordRequestSchema', () => {
  const valid = { email: 'ada@example.com', otp: '123456', newPassword: 'abcdefg1' };

  it('accepts a valid body and normalises the email', () => {
    const result = ResetPasswordRequestSchema.parse({ ...valid, email: ' Ada@Example.COM ' });
    expect(result).toEqual(valid);
  });

  it('accepts an otp with leading zeros', () => {
    expect(ResetPasswordRequestSchema.safeParse({ ...valid, otp: '000123' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(ResetPasswordRequestSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });

  it('rejects an otp that is not six digits and names the otp field', () => {
    for (const otp of ['12345', '1234567', '12a456']) {
      const result = ResetPasswordRequestSchema.safeParse({ ...valid, otp });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['otp']);
    }
  });

  it('rejects an otp that is not a string', () => {
    expect(ResetPasswordRequestSchema.safeParse({ ...valid, otp: 123456 }).success).toBe(false);
  });

  it('rejects a weak newPassword and names the newPassword field', () => {
    for (const newPassword of ['short1', '12345678', 'abcdefgh', `${'a'.repeat(128)}1`]) {
      const result = ResetPasswordRequestSchema.safeParse({ ...valid, newPassword });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['newPassword']);
    }
  });
});
