import type { EmailService } from '../../src/modules/email/email.service.js';

// Records every OTP instead of printing it. With `reject`, delivery fails with an error whose
// message holds the email and OTP, so a test can prove the message is never logged.
export const createSpyEmailService = ({ reject = false }: { reject?: boolean } = {}) => {
  const calls: { email: string; otp: string }[] = [];
  const service: EmailService & {
    calls: typeof calls;
    otpFor: (email: string) => string;
  } = {
    calls,
    sendOtp: (email, otp) => {
      calls.push({ email, otp });
      return reject
        ? Promise.reject(new Error(`delivery to ${email} failed for ${otp}`))
        : Promise.resolve();
    },
    otpFor: (email) => {
      const otp = calls.findLast((call) => call.email === email)?.otp;
      if (otp === undefined) throw new Error(`no OTP was sent to ${email}`);
      return otp;
    },
  };
  return service;
};
