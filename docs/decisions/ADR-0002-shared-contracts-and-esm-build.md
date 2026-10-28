# ADR-0002: Shared contracts in `packages/shared`, ESM build order

- Status: Proposed (approved together with `docs/SDS.md`)
- Date: 2026-10-28
- Tickets: AB-1001 (setup), every later ticket (consumers)
- SDS: Sections 2.3, 7.2, 11.1, 11.2

## Context

Rule 11 says all TypeScript types and Zod schemas live in `packages/shared` only. The backend (Node, ESM) and the frontend (Vite) both consume it. The package must be usable by both without duplicating a type.

## Decision

- `packages/shared` contains Zod schemas, `z.infer` types and the numeric or string limits those schemas reference. Nothing else: no React, no Prisma, no business logic.
- Schemas are written once per request and per response. The backend validates input with them and parses output with them. The frontend validates forms with them and parses responses with them.
- The package is compiled with `tsc` to `dist/` as ESM with `.d.ts` files. `package.json` `exports` point to `dist`.
- Root `pnpm build` and `pnpm dev` build or watch `shared` first (`pnpm -r` respects workspace dependency order).
- Backend and shared use `module` and `moduleResolution` `NodeNext` with `.js` suffixes on relative imports. The frontend uses `Bundler` resolution.
- Zod 4.6.7 is a dependency of `shared` only; backend and frontend import schemas, not Zod itself, except where they build one-off schemas (for example environment validation in the backend).

## Consequences

- One definition per shape; a contract change is one edit plus the OpenAPI delta.
- A fresh clone must build `shared` before type-checking consumers. The root scripts and CI do this.
- `.js` suffixes in TypeScript imports are a small, well-known cost of Node ESM.

## Alternatives considered

- **Consume `shared` from TypeScript source (no build):** simpler in dev, but the backend `tsc` build and Vitest would each need extra path mapping or a loader, and Node cannot run the emitted result.
- **Generate types from OpenAPI:** rejected. The Zod schema must exist anyway for runtime validation, so generating types from a second source would create the duplication Rule 11 forbids.
- **CommonJS output:** rejected. Prisma 7 and the current tooling are ESM-first.
