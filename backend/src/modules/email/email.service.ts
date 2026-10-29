import type { Clock } from '../../common/clock.js';

export interface EmailService {
  sendOtp(email: string, otp: string): Promise<void>;
}

export type OtpSink = (record: { email: string; otp: string }) => Promise<void>;

// The shape of src/testing/otp-test-sink.ts, which is loaded only when NODE_ENV is test (ADR-0004).
export interface OtpSinkModule {
  createOtpTestSink: (options: { filePath?: string | undefined; clock: Clock }) => OtpSink;
}

export type ConsoleWrite = (line: string) => void;

// The only OTP delivery (AC-PWD-10, no real email). It writes through an injected function instead
// of pino so the line shows at every LOG_LEVEL and stays out of the redacted structured logs.
export class ConsoleEmailService implements EmailService {
  readonly sink: OtpSink | undefined;
  private readonly write: ConsoleWrite;

  constructor({ write, sink }: { write: ConsoleWrite; sink?: OtpSink | undefined }) {
    this.write = write;
    this.sink = sink;
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    // The console line comes first and does not depend on the sink (S-AB1003-23).
    this.write(`password reset code for ${email}: ${otp}`);
    await this.sink?.({ email, otp });
  }
}
