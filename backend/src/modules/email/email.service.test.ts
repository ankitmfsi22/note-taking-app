import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEmailService } from './build-email-service.js';
import { ConsoleEmailService } from './email.service.js';

const ISSUED_AT = '2026-10-29T09:00:00.000Z';
const clock = { now: () => new Date(ISSUED_AT) };
const loadSink = () => import('../../testing/otp-test-sink.js');

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'otp-sink-'));
  filePath = join(dir, 'nested', 'otp.jsonl');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const buildForTest = (write: (line: string) => void) =>
  buildEmailService({ env: { NODE_ENV: 'test', OTP_TEST_FILE: filePath }, write, clock, loadSink });

describe('ConsoleEmailService', () => {
  it('S-AB1003-19: ConsoleEmailService logs the email and OTP to the console', async () => {
    const write = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await new ConsoleEmailService({ write }).sendOtp('ada@example.com', '042517');

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toContain('ada@example.com');
    expect(write.mock.calls[0]?.[0]).toContain('042517');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('S-AB1003-20: the test sink appends a JSON line per OTP when NODE_ENV is test', async () => {
    const service = await buildForTest(vi.fn());

    await service.sendOtp('ada@example.com', '042517');
    await service.sendOtp('ada@example.com', '913004');

    const lines = (await readFile(filePath, 'utf8')).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1] ?? '')).toEqual({
      email: 'ada@example.com',
      otp: '913004',
      issuedAt: ISSUED_AT,
    });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it('S-AB1003-23: the console log is unchanged while the sink is active', async () => {
    const plainWrite = vi.fn();
    await new ConsoleEmailService({ write: plainWrite }).sendOtp('ada@example.com', '042517');
    const sinkWrite = vi.fn();

    await (await buildForTest(sinkWrite)).sendOtp('ada@example.com', '042517');

    expect(sinkWrite.mock.calls).toEqual(plainWrite.mock.calls);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toMatchObject({ otp: '042517' });
  });
});
