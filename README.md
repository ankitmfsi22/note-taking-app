# note-taking-app

Full-stack Note Taking App built as a Spec-Driven Development exercise. See `AGENTS.md`, `docs/FRS.md` and `docs/SDS.md`.

## Project status

Status as of 2026-10-29. PR links point to https://github.com/ankitmfsi22/note-taking-app.

| Ticket | Scope | Status | PR |
| --- | --- | --- | --- |
| AB-1001 | Project setup | Merged | [#2](https://github.com/ankitmfsi22/note-taking-app/pull/2) |
| AB-1002 | Auth: register, login, refresh, logout | Merged | [#3](https://github.com/ankitmfsi22/note-taking-app/pull/3) |
| AB-1003 | Auth: forgot password + OTP reset | Merged | [#4](https://github.com/ankitmfsi22/note-taking-app/pull/4) |
| AB-1004 | Notes: CRUD, soft delete, trash | Merged | [#5](https://github.com/ankitmfsi22/note-taking-app/pull/5) |
| AB-1005 | Notes: pagination, sorting, tag filter | Merged | [#6](https://github.com/ankitmfsi22/note-taking-app/pull/6) |
| AB-1006 | Tags: CRUD, note counts | Merged | [#7](https://github.com/ankitmfsi22/note-taking-app/pull/7) |
| AB-1007 | Search: full-text with highlight | Merged | [#8](https://github.com/ankitmfsi22/note-taking-app/pull/8) |
| AB-1008 | Sharing: links, revoke, public read | Merged | [#9](https://github.com/ankitmfsi22/note-taking-app/pull/9) |
| AB-1009 | Version history + restore | Merged | [#11](https://github.com/ankitmfsi22/note-taking-app/pull/11) |
| AB-1010 | Frontend: auth pages | Merged | [#10](https://github.com/ankitmfsi22/note-taking-app/pull/10) |
| AB-1011 | Frontend: notes list | Branch pushed, no PR yet | - |
| AB-1012 | Frontend: editor + autosave | Branch pushed, no PR yet | - |
| AB-1013 | Frontend: search UI | PR open | [#12](https://github.com/ankitmfsi22/note-taking-app/pull/12) |
| AB-1014 | Frontend: share modal, links, public page | PR open | [#13](https://github.com/ankitmfsi22/note-taking-app/pull/13) |
| AB-1015 | Frontend: version drawer | Spec, design and tasks pushed, awaiting approval | - |
| AB-1016 | E2E: Playwright journey | Spec approved, design and tasks pushed | - |

## How to run

Requires Node 22, pnpm 10 and Docker.

```sh
pnpm install
pnpm db:up        # Postgres 16 via docker compose
pnpm dev          # builds shared, then runs backend and frontend
pnpm test         # unit, integration and component tests (add --coverage)
pnpm test:e2e     # Playwright (needs AB-1011 to AB-1015 merged)
pnpm db:down      # stop the databases
```

Other checks: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm spec:validate`, `pnpm check:scenarios`.
