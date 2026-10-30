## Tasks (tests first; each under 45 minutes; no `[PARALLEL]` work, backend only)

- [ ] 1.1 Correct and complete `docs/api/openapi.yaml` against the routes and Zod schemas (40 min)
- [ ] 1.2 S-AB1016-06 and S-AB1016-07: spec validity and route-coverage tests (40 min)
- [ ] 1.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`
- [ ] 2.1 `API_DOCS_ENABLED` in `Env`, `.env.example`; S-AB1016-11 (15 min)
- [ ] 2.2 `modules/docs` router, mount in `createApp`, relaxed CSP (30 min)
- [ ] 2.3 S-AB1016-08, S-AB1016-09, S-AB1016-10, S-AB1016-12 Supertest tests (30 min)
- [ ] 2.4 Checkpoint: full gate, run the built backend and fetch `/api/docs`
- [ ] 3.1 README: API docs section, env table, features, overview, status (20 min)
- [ ] 3.2 Final checkpoint: all gates, `pnpm spec:validate`, `pnpm check:scenarios`, e2e

## Coverage

| Spec scenario | Task |
| --- | --- |
| S-AB1016-06 | 1.2 |
| S-AB1016-07 | 1.2 |
| S-AB1016-08 | 2.3 |
| S-AB1016-09 | 2.3 |
| S-AB1016-10 | 2.3 |
| S-AB1016-11 | 2.1 |
| S-AB1016-12 | 2.3 |
