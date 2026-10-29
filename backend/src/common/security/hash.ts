import { createHmac, timingSafeEqual } from 'node:crypto';
import { hash, verify, type Algorithm } from '@node-rs/argon2';

// `Algorithm` is a `const enum`: it has no runtime value and cannot be used under isolatedModules,
// so the Argon2id member (2) is spelled as a number typed against the library's enum. Passing it
// keeps Argon2id explicit instead of depending on the library default.
const ARGON2ID: Algorithm = 2;

// Any fixed string works: the dummy hash exists only so an unknown email costs one real verify.
const DUMMY_PASSWORD = 'timing-equalisation-dummy-password';

interface PasswordHasherParams {
  memoryCost: number;
  timeCost: number;
}

export const createPasswordHasher = ({ memoryCost, timeCost }: PasswordHasherParams) => {
  const options = { algorithm: ARGON2ID, memoryCost, timeCost, parallelism: 1 };

  let dummyHash: string | undefined;
  let pendingDummyHash: Promise<string> | undefined;
  // Computed on first use from the same parameters as real hashes, so the dummy verify takes as
  // long as a real one even when env changes the parameters. The promise is shared so concurrent
  // first calls hash once.
  const ensureDummyHash = (): Promise<string> =>
    (pendingDummyHash ??= hash(DUMMY_PASSWORD, options).then((value) => (dummyHash = value)));

  return {
    hash: (password: string): Promise<string> => hash(password, options),
    verify: (encodedHash: string, password: string): Promise<boolean> =>
      verify(encodedHash, password),
    // Does the work of a failed login and always answers false.
    verifyDummy: async (password: string): Promise<false> => {
      await verify(await ensureDummyHash(), password);
      return false;
    },
    get dummyHash(): string | undefined {
      return dummyHash;
    },
  };
};

export type PasswordHasher = ReturnType<typeof createPasswordHasher>;

// Not a real user: the dummy check hashes against it so an unknown email does the same work.
const DUMMY_OTP_USER_ID = '00000000-0000-7000-8000-000000000000';

// HMAC keyed by OTP_HMAC_SECRET (SDS 5.5): a 6-digit code has only 10^6 values, so an unkeyed
// hash in a leaked table would be reversed instantly.
export const createOtpHasher = ({ secret }: { secret: string }) => {
  const hashOtp = (userId: string, otp: string): string =>
    createHmac('sha256', secret).update(`${userId}:${otp}`).digest('hex');

  const equal = (storedHash: string, candidate: string): boolean => {
    const stored = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(candidate, 'hex');
    // timingSafeEqual throws on a length mismatch; a malformed stored value is simply no match.
    return stored.length === actual.length && timingSafeEqual(stored, actual);
  };

  return {
    hash: hashOtp,
    matches: (storedHash: string, userId: string, otp: string): boolean =>
      equal(storedHash, hashOtp(userId, otp)),
    // Does the work of a failed match and always answers false.
    verifyDummy: (otp: string): false => {
      equal(hashOtp(DUMMY_OTP_USER_ID, otp), hashOtp(DUMMY_OTP_USER_ID, `${otp}x`));
      return false;
    },
  };
};

export type OtpHasher = ReturnType<typeof createOtpHasher>;
