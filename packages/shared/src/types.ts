import type { z } from 'zod';
import type {
  ErrorCodeSchema,
  ErrorDetailSchema,
  ErrorResponseSchema,
  IdSchema,
} from './schemas/common.js';
import type { HealthResponseSchema } from './schemas/health.js';

export type Id = z.infer<typeof IdSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
