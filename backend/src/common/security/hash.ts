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
