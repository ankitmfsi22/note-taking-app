## Why

The app runs only through local Node tooling plus the dev databases. A reviewer or user cannot start the whole product with one command. AB-1016 closes the project, so this change adds a self-contained container setup (backend, frontend, database) without touching application code.

## What Changes

- `backend/Dockerfile`: multi-stage, pnpm 10.34.9 via corepack, `node:22.21.0-slim` (Debian, so the `@node-rs/argon2` glibc binary works), non-root `node` user, runs `prisma migrate deploy` then `node dist/server.js`, Node-based HEALTHCHECK on `/api/v1/health`.
- `frontend/Dockerfile` and `frontend/nginx.conf`: Vite build served by `nginxinc/nginx-unprivileged:1.31.7-alpine` with SPA fallback, gzip, immutable cache headers for hashed assets, `no-cache` for `index.html`, and an `/api` reverse proxy to the backend.
- `.dockerignore` at the repository root (the build context, because of the pnpm workspace and `packages/shared`).
- `docker-compose.yml`: new profile `full` (`db`, `backend`, `frontend`) with health-gated `depends_on`, a named data volume and `restart: unless-stopped`. `db-dev` and `db-test` move to profile `dev`, and `pnpm db:up` / `pnpm db:down` pass `--profile dev`, so their behaviour is unchanged and `--profile full` never starts them.
- `.env.example` documents the optional Docker variables; README gains a "Run with Docker" section.
- No application code changes. No new API, status or error code.

## FRS coverage

Infrastructure only: no FRS acceptance criterion changes. It does not alter any binding SDS endpoint, status or error code. SDS section 11.4 describes the compose file; the added profiles are additive (see design).

| Concern | Scenarios |
| --- | --- |
| Backend image | S-AB1016-06 |
| Frontend image and proxy | S-AB1016-07 |
| Compose full profile | S-AB1016-08 |
| Dev databases unchanged | S-AB1016-09 |
| Build context hygiene, no secrets in images | S-AB1016-10 |
| Origin check works behind the proxy | S-AB1016-11 |

Authorization-denied and validation-failure scenarios do not apply: the change adds no endpoint. The existing origin check keeps its `403 FORBIDDEN_ORIGIN` behaviour; S-AB1016-11 only pins the configuration that makes the browser origin pass it.

## Out of scope

TLS termination, a registry or CI image publishing, Kubernetes, production secret management.

## Rollback

Delete the Dockerfiles, `frontend/nginx.conf`, `.dockerignore` and the `full` services, and restore the two unprofiled dev services and the original `db:up`/`db:down` scripts.
