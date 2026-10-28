import { pino, type DestinationStream, type Logger } from 'pino';
import type { Env } from '../config/env.js';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.newPassword',
  'req.body.otp',
  'req.body.refreshToken',
];

export const createLogger = (
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
  stream?: DestinationStream,
): Logger => {
  const options = { level: env.LOG_LEVEL, redact: { paths: REDACT_PATHS, remove: true } };
  // pino accepts either a transport or a destination stream, never both.
  if (env.NODE_ENV === 'development' && !stream) {
    return pino({ ...options, transport: { target: 'pino-pretty' } });
  }
  return pino(options, stream);
};
