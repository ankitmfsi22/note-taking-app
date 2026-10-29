import type { Clock } from '../../common/clock.js';
import type { Env } from '../../config/env.js';
import { ConsoleEmailService, type ConsoleWrite, type OtpSinkModule } from './email.service.js';

interface BuildEmailServiceDeps {
  env: Pick<Env, 'NODE_ENV'> & { OTP_TEST_FILE?: string | undefined };
  write: ConsoleWrite;
  clock: Clock;
  // Given only by the NODE_ENV=test branch of server.ts, so no other build ever imports the sink.
  loadSink?: (() => Promise<OtpSinkModule>) | undefined;
}

export const buildEmailService = async ({
  env,
  write,
  clock,
  loadSink,
}: BuildEmailServiceDeps): Promise<ConsoleEmailService> => {
  if (env.NODE_ENV !== 'test' || loadSink === undefined) return new ConsoleEmailService({ write });
  const { createOtpTestSink } = await loadSink();
  return new ConsoleEmailService({
    write,
    sink: createOtpTestSink({ filePath: env.OTP_TEST_FILE, clock }),
  });
};
