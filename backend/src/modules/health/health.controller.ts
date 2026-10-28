import { HealthResponseSchema } from '@note-app/shared';
import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_req, res) => {
  res.json(HealthResponseSchema.parse({ status: 'ok' }));
};
