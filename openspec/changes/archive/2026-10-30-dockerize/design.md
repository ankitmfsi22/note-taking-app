## Context

pnpm workspace with `packages/shared` consumed by backend and frontend, so every image builds from the repository root (`-f backend/Dockerfile .`) with one root `.dockerignore`.

## Decisions

- **Debian slim, not Alpine.** `@node-rs/argon2` ships glibc and musl binaries, but slim avoids musl surprises with Prisma engines. Base `node:22.21.0-slim` matches `.nvmrc`.
- **Prisma at runtime.** `prisma` is a devDependency, so `pnpm deploy --prod` omits it. The build stage adds the same pinned version (`prisma@7.10.1`, exact) into the deployed folder, and copies `prisma/` and `prisma.config.ts`. Prisma 7 reads the URL from `prisma.config.ts` (`process.env.DATABASE_URL`), which compose provides; the missing `../.env` is ignored by `dotenv` (`quiet`).
- **`--ignore-scripts` on install.** The root `postinstall` runs `prisma generate`, which needs the schema; the backend build script runs it instead.
- **nginx fronts everything.** The browser only sees `http://localhost:8080`; `/api/` is proxied (runtime DNS via Docker's resolver, so nginx starts before the backend is healthy). Same origin keeps the `SameSite=Strict` cookie at `Path=/api/v1/auth` working and `APP_ORIGIN=http://localhost:8080` satisfies the origin check. `Origin` and `Set-Cookie` pass through untouched.
- **Production env.** `NODE_ENV=production` forces `COOKIE_SECURE=true`; browsers treat `http://localhost` as a secure context for Secure cookies.
- **Profiles.** Services without a profile always start, so `--profile full` would start `db-dev`/`db-test` and clash on ports. They move to profile `dev`; the root scripts pass `--profile dev`. SDS 11.4 and section 11 scripts should gain a note; behaviour for `pnpm db:up` is unchanged.
- **Tests.** Static checks in `scripts/docker-setup.test.mjs` (node:test, run by `pnpm test:tooling`). Runtime behaviour is verified by a compose smoke test recorded in the PR.

## Risks

Image builds are not run in CI (no Docker build job); the static tests guard the configuration.
