## Tasks (no `[PARALLEL]` work, infrastructure only)

- [x] 1.1 Static tests `scripts/docker-setup.test.mjs` for S-AB1016-26 to S-AB1016-31
- [x] 1.2 `.dockerignore`, `backend/Dockerfile` incl. `docs/api/openapi.yaml` (S-AB1016-26, S-AB1016-30)
- [x] 1.3 `frontend/Dockerfile`, `frontend/nginx.conf` (S-AB1016-27)
- [x] 1.4 `docker-compose.yml` profiles, `db:*` scripts, `.env.example` (S-AB1016-28, 29, 31)
- [x] 1.5 Checkpoint: build, lint, format, tests, spec validate, check scenarios, e2e
- [x] 2.1 Compose smoke test: health, register, login, note, gzip, immutable, SPA fallback, `/api/docs`
- [x] 2.2 README "Run with Docker"

## Coverage

| Spec scenario | Task |
| --- | --- |
| S-AB1016-26 | 1.1, 1.2 |
| S-AB1016-27 | 1.1, 1.3 |
| S-AB1016-28 | 1.1, 1.4 |
| S-AB1016-29 | 1.1, 1.4 |
| S-AB1016-30 | 1.1, 1.2, 1.4 |
| S-AB1016-31 | 1.1, 1.4 |
