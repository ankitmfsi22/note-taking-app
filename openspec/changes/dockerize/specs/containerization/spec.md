## Purpose

Defines how the app is packaged and run as containers: backend and frontend images, the Docker Compose `full` profile, and the guarantees that the existing development databases and secrets handling are unaffected.

## ADDED Requirements

### Requirement: Backend image
The backend SHALL build into a multi-stage image from the repository root, on an exactly pinned Debian-based `node:22` slim tag, running as a non-root user, applying migrations with `prisma migrate deploy` before starting `node dist/server.js`, with a HEALTHCHECK on `/api/v1/health` that needs no curl.

#### Scenario: S-AB1016-06 the backend image is pinned, non-root, migrating and health-checked
- **WHEN** `backend/Dockerfile` is read
- **THEN** its base images use an exact `node:22.x.y-slim` tag, it switches to `USER node`, its command runs `prisma migrate deploy` before `node dist/server.js`, and its HEALTHCHECK calls `/api/v1/health` with Node

### Requirement: Frontend image and proxy
The frontend SHALL build into an image served by an exactly pinned unprivileged nginx. The nginx configuration SHALL fall back to `index.html` for client routes, enable gzip, serve `/assets/` with `Cache-Control: public, max-age=31536000, immutable`, serve `index.html` with `no-cache`, and proxy `/api/` to the backend while forwarding `Host` and `X-Forwarded-*` headers.

#### Scenario: S-AB1016-07 nginx serves the SPA with caching rules and proxies the API
- **WHEN** `frontend/Dockerfile` and `frontend/nginx.conf` are read
- **THEN** the runtime image is `nginxinc/nginx-unprivileged` with an exact version tag, and the configuration has `try_files ... /index.html`, `gzip on`, the immutable header on `/assets/`, `no-cache` on `index.html`, and a `/api/` proxy to the `backend` service with `Host` and `X-Forwarded-For` forwarded

### Requirement: Compose full profile
`docker-compose.yml` SHALL provide a `full` profile with `db`, `backend` and `frontend`. The database SHALL have a healthcheck and a named volume, the backend SHALL wait for a healthy database and the frontend for a healthy backend (`condition: service_healthy`), every service SHALL restart `unless-stopped`, only the frontend SHALL publish a host port, and no image SHALL use the `latest` tag.

#### Scenario: S-AB1016-08 the full profile is health-gated, persistent and exposes only the frontend
- **WHEN** `docker-compose.yml` is read
- **THEN** `db`, `backend` and `frontend` are in profile `full`, `depends_on` uses `service_healthy`, `db` mounts a named volume and has a healthcheck, `ports` appears only on `frontend` (`8080:8080`), and no image tag is `latest`

### Requirement: Development databases unchanged
The `db-dev` and `db-test` services SHALL keep their images, ports and volumes. They SHALL sit in profile `dev`, and `pnpm db:up` and `pnpm db:down` SHALL pass `--profile dev`, so the full profile never starts them and the scripts behave as before.

#### Scenario: S-AB1016-09 the dev databases keep their ports and are started by the db scripts
- **WHEN** `docker-compose.yml` and `package.json` are read
- **THEN** `db-dev` publishes `5432:5432` and `db-test` publishes `5433:5432`, both in profile `dev`, and `db:up` and `db:down` contain `--profile dev`

### Requirement: No secrets or build output in images
A `.dockerignore` at the build-context root SHALL exclude environment files, `node_modules`, build output and the git directory. No Dockerfile SHALL copy an env file, and the compose file SHALL take the JWT and OTP secrets from the environment with a required-variable check rather than hard-coding them.

#### Scenario: S-AB1016-10 env files and build output stay out of the build context
- **WHEN** `.dockerignore`, the Dockerfiles and `docker-compose.yml` are read
- **THEN** `.dockerignore` lists `.env*`, `**/node_modules`, `**/dist` and `.git`, no Dockerfile copies an env file, and the backend `JWT_ACCESS_SECRET` and `OTP_HMAC_SECRET` use `${NAME:?...}` interpolation

### Requirement: Browser origin passes the origin check
The compose backend SHALL set `APP_ORIGIN` to the published frontend origin (`http://localhost:8080`) and `COOKIE_SECURE` to `true` with `NODE_ENV=production`, so the browser's requests through the proxy pass the existing origin check (a foreign origin is still `403 FORBIDDEN_ORIGIN`).

#### Scenario: S-AB1016-11 the backend origin matches the published frontend origin
- **WHEN** `docker-compose.yml` is read
- **THEN** the backend `APP_ORIGIN` defaults to `http://localhost:8080`, matching the host port published by `frontend`, with `NODE_ENV` `production` and `COOKIE_SECURE` `'true'`
