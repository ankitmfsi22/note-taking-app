---
name: spec-scenario-format
description: Format and coverage rules for OpenSpec requirements and scenarios in this project (S-AB IDs, required scenario types). Use when writing or reviewing a spec delta.
---

# Spec and scenario format

A ticket's delta lives at `openspec/changes/AB-xxxx-<slug>/specs/<capability>/spec.md`.

```markdown
## ADDED Requirements

### Requirement: Login returns tokens
The system SHALL return an access token and set the refresh cookie for valid credentials.

#### Scenario: S-AB1002-03 login with wrong password
- **WHEN** a user posts a correct email and a wrong password to `POST /auth/login`
- **THEN** the response is `401` with `error.code` `INVALID_CREDENTIALS`
```

## Rules

- Scenario ID: `S-AB<ticket>-<nn>`, two digits starting at 01, unique within the ticket. The test title must start with the same ID (SDS section 10.3). `pnpm check:scenarios` enforces one test per ID.
- Requirements use SHALL. Scenarios use WHEN and THEN and name the exact status and `error.code`.
- Every FRS AC and ERR ID of the ticket is covered by at least one scenario. Name the FRS ID in the requirement text.
- Every ticket delta includes one **authorization-denied** scenario (another user's resource gives 404, or no token gives 401) and one **validation-failure** scenario (400 `VALIDATION_ERROR`).
- Use only the error codes in SDS section 4.3. Never invent a code or status.
- Mark anything the FRS and SDS do not decide as `[ASSUMPTION — confirm]`.
