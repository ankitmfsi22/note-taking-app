# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:22.21.0-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# Prisma's schema engine needs OpenSSL, which the slim image omits.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /repo

# Manifests first so the dependency layer is cached. --ignore-scripts skips the root postinstall
# (prisma generate), which needs the schema; the build below runs it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @note-app/shared run build && pnpm --filter backend run build

# /out/app: the server with production dependencies only.
RUN pnpm --filter backend deploy --prod --legacy /out/app \
  && cp -r /repo/backend/dist /out/app/dist

# /out/migrate: the prisma CLI (a devDependency in the workspace, so absent from the server
# folder) with the schema, migrations and prisma.config.ts, used only by `prisma migrate deploy`.
# The version matches backend/package.json.
WORKDIR /out/migrate
RUN echo '{"name":"migrate","private":true,"dependencies":{"prisma":"7.10.1","dotenv":"18.0.9"}}' > package.json \
  && pnpm install --prod --ignore-scripts \
  && cp -r /repo/backend/prisma /repo/backend/prisma.config.ts .

FROM node:22.21.0-slim AS runtime
ENV NODE_ENV=production PORT=3000
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /out /srv
WORKDIR /srv/app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["sh", "-c", "(cd /srv/migrate && ./node_modules/.bin/prisma migrate deploy) && exec node dist/server.js"]
