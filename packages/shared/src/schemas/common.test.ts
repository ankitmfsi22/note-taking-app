import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ErrorCodeSchema, ErrorResponseSchema, IdSchema } from './common.js';

const SDS_ERROR_CODES = [
  'VALIDATION_ERROR',
  'MALFORMED_JSON',
  'OTP_INVALID_OR_EXPIRED',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'FORBIDDEN_ORIGIN',
  'ROUTE_NOT_FOUND',
  'NOTE_NOT_FOUND',
  'TAG_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'SHARE_LINK_NOT_FOUND',
  'EMAIL_TAKEN',
  'TAG_NAME_TAKEN',
  'VERSION_ALREADY_CURRENT',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
];

describe('ErrorCodeSchema', () => {
  it('lists exactly the binding codes of SDS section 4.3', () => {
    expect(ErrorCodeSchema.options).toEqual(SDS_ERROR_CODES);
  });

  it('matches the ErrorCode enum in docs/api/openapi.yaml', () => {
    const yaml = readFileSync(
      new URL('../../../../docs/api/openapi.yaml', import.meta.url),
      'utf8',
    );
    const block = /\n {4}ErrorCode:\n[\s\S]*?\n {6}enum:\n((?: {8}- \w+\n)+)/.exec(yaml);
    expect(block).not.toBeNull();
    const codes = [...(block?.[1] ?? '').matchAll(/- (\w+)/g)].map((match) => match[1]);
    expect(codes).toEqual(SDS_ERROR_CODES);
  });

  it('rejects a code that is not in the table', () => {
    expect(ErrorCodeSchema.safeParse('FORBIDDEN').success).toBe(false);
  });
});

describe('ErrorResponseSchema', () => {
  const base = { code: 'VALIDATION_ERROR', message: 'Request validation failed', requestId: 'r-1' };

  it('accepts a validation error with details', () => {
    const body = { error: { ...base, details: [{ field: 'email', message: 'Invalid email' }] } };
    expect(ErrorResponseSchema.safeParse(body).success).toBe(true);
  });

  it('accepts an error without details', () => {
    const body = { error: { ...base, code: 'NOTE_NOT_FOUND', message: 'Note not found' } };
    expect(ErrorResponseSchema.safeParse(body).success).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(ErrorResponseSchema.safeParse({ error: { ...base, code: 'NOPE' } }).success).toBe(false);
  });

  it('rejects a body without requestId', () => {
    const { requestId: _requestId, ...withoutRequestId } = base;
    expect(ErrorResponseSchema.safeParse({ error: withoutRequestId }).success).toBe(false);
  });
});

describe('IdSchema', () => {
  it('accepts a UUID', () => {
    expect(IdSchema.safeParse('0192f3f0-7b1e-7a3c-9d2e-3c5f1a2b4d6e').success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(IdSchema.safeParse('not-an-id').success).toBe(false);
  });
});
