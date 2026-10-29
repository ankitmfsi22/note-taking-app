## Tasks (tests first; each is under 45 minutes; no `[PARALLEL]` work, one test package)

- [ ] 1.1 Support: DB truncate and OTP-file clear in `e2e/support/fixtures.ts`; `readLatestOtp` and `registerUser` helpers (30 min)
- [ ] 1.2 Checkpoint: smoke test still passes with the new fixture
- [ ] 2.1 S-AB1016-03 invalid login: error shown, `/notes` redirects to `/login` (20 min)
- [ ] 2.2 S-AB1016-04 revoked public link and too-short password (30 min)
- [ ] 2.3 S-AB1016-02 forgot password with OTP from `otp.jsonl` (30 min)
- [ ] 2.4 Checkpoint: `pnpm test:e2e`, `pnpm check:scenarios`
- [ ] 3.1 S-AB1016-01 full journey in `journey.spec.ts`, built step by step (45 min)
- [ ] 3.2 S-AB1016-05 isolation: run single, reversed and full-suite orders (20 min)
- [ ] 3.3 Final checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test:e2e`, `pnpm spec:validate`, `pnpm check:scenarios`

## Coverage

| Spec scenario | Task |
| --- | --- |
| S-AB1016-01 | 3.1 |
| S-AB1016-02 | 2.3 |
| S-AB1016-03 | 2.1 |
| S-AB1016-04 | 2.2 |
| S-AB1016-05 | 3.2 |

Blocked until AB-1011 to AB-1015 are merged.
