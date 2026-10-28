import { describe, expect, it } from 'vitest';
import { createLogCapture } from '../../tests/support/test-app.js';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('removes secrets at the redacted paths', () => {
    const logs = createLogCapture();
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' }, logs.stream);
    logger.info({
      req: {
        headers: { authorization: 'Bearer abc', cookie: 'refresh_token=def', host: 'localhost' },
        body: { password: 'p1', newPassword: 'p2', otp: '123456', refreshToken: 'rt', title: 'ok' },
      },
      res: { headers: { 'set-cookie': ['refresh_token=ghi'], 'content-type': 'application/json' } },
    });
    const line = JSON.parse(logs.text()) as {
      req: { headers: Record<string, string>; body: Record<string, string> };
      res: { headers: Record<string, unknown> };
    };
    expect(line.req.headers).toEqual({ host: 'localhost' });
    expect(line.req.body).toEqual({ title: 'ok' });
    expect(line.res.headers).toEqual({ 'content-type': 'application/json' });
    expect(logs.text()).not.toMatch(/Bearer abc|refresh_token|123456|p1|p2/);
  });

  it('honours the configured level', () => {
    const logs = createLogCapture();
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'warn' }, logs.stream);
    logger.info('hidden');
    logger.warn('shown');
    expect(logs.text()).not.toContain('hidden');
    expect(logs.text()).toContain('shown');
  });

  it('writes nothing at level silent', () => {
    const logs = createLogCapture();
    createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }, logs.stream).error('boom');
    expect(logs.text()).toBe('');
  });
});
