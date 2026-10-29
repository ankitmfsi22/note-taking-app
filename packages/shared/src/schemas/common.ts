import { z } from 'zod';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/limits.js';

export const IdSchema = z.uuid();

// Query strings arrive as text, so the numbers are coerced (FRS A-16).
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export const paginated = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: z.int().min(1),
    pageSize: z.int().min(1),
    total: z.int().min(0),
    totalPages: z.int().min(0),
  });

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
