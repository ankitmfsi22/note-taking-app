import { z } from 'zod';

// OWASP minimum for Argon2id, enforced in production only (tests use cheap values).
const ARGON2_MIN_MEMORY_KIB = 19456;
const ARGON2_MIN_TIME_COST = 2;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a PostgreSQL connection URL'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    JWT_ACCESS_SECRET: z
      .string()
      .refine((value) => Buffer.byteLength(value) >= 32, 'must be at least 32 bytes'),
    OTP_HMAC_SECRET: z
      .string()
      .refine((value) => Buffer.byteLength(value) >= 32, 'must be at least 32 bytes'),
    OTP_TEST_FILE: z.string().min(1).optional(),
    APP_ORIGIN: z.url(),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(ARGON2_MIN_MEMORY_KIB),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(ARGON2_MIN_TIME_COST),
    // SDS 8.5: the in-process purge scheduler; off when an external cron runs job:purge.
    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.OTP_HMAC_SECRET === env.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_HMAC_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET',
      });
    }
    // The OTP sink is test-only (ADR-0004); no other environment may enable it.
    if (env.OTP_TEST_FILE !== undefined && env.NODE_ENV !== 'test') {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_TEST_FILE'],
        message: 'is allowed only when NODE_ENV is test',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'must be true in production',
      });
    }
    if (env.ARGON2_MEMORY_KIB < ARGON2_MIN_MEMORY_KIB) {
      ctx.addIssue({
        code: 'custom',
        path: ['ARGON2_MEMORY_KIB'],
        message: `must be at least ${ARGON2_MIN_MEMORY_KIB} in production`,
      });
    }
    if (env.ARGON2_TIME_COST < ARGON2_MIN_TIME_COST) {
      ctx.addIssue({
        code: 'custom',
        path: ['ARGON2_TIME_COST'],
        message: `must be at least ${ARGON2_MIN_TIME_COST} in production`,
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = EnvSchema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
};
