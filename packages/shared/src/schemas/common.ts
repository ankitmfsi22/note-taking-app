import { z } from 'zod';

export const IdSchema = z.uuid();

export const ErrorCodeSchema = z.enum([
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
]);

export const ErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
    requestId: z.string(),
  }),
});
