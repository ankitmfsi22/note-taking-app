## ADDED Requirements

### Requirement: Liveness endpoint
The system SHALL expose an unauthenticated `GET /api/v1/health` that answers `200` with `{ "status": "ok" }` and does not query the database (SDS SA-29, SA-54).

#### Scenario: S-AB1001-01 health returns 200 with the shared shape
- **WHEN** a client sends `GET /api/v1/health` without credentials
- **THEN** the response is `200` with a JSON body that parses as `HealthResponseSchema`

### Requirement: One error response shape (FR-X-5)
Every error response SHALL have the body `{ "error": { "code", "message", "details?", "requestId" } }`. The `code` SHALL be one of the codes in SDS section 4.3 and its HTTP status SHALL be the one in that table. The `message` SHALL NOT contain internal detail. The `requestId` SHALL equal the `X-Request-Id` response header.

#### Scenario: S-AB1001-02 unknown route returns 404 ROUTE_NOT_FOUND
- **WHEN** a client sends `GET /api/v1/nope`
- **THEN** the response is `404` with a body that parses as `ErrorResponseSchema`, the code is `ROUTE_NOT_FOUND`, and `requestId` equals the `X-Request-Id` header

#### Scenario: S-AB1001-03 unexpected failure returns 500 INTERNAL_ERROR without leaking details
- **WHEN** a handler throws an unexpected error whose message contains a secret
- **THEN** the response is `500` with code `INTERNAL_ERROR` and the message `Internal server error`, the secret is not in the response body, and the error is logged

#### Scenario: S-AB1001-04 unparseable JSON returns 400 MALFORMED_JSON
- **WHEN** a client sends a request with `Content-Type: application/json` and a body that is not valid JSON
- **THEN** the response is `400` with code `MALFORMED_JSON`

#### Scenario: S-AB1001-05 oversized body returns 413 PAYLOAD_TOO_LARGE
- **WHEN** a client sends a JSON body larger than the configured limit
- **THEN** the response is `413` with code `PAYLOAD_TOO_LARGE`

#### Scenario: S-AB1001-07 error codes map to the statuses of the SDS table
- **WHEN** the status table in the backend is compared with the table in SDS section 4.3
- **THEN** both contain the same 17 codes with the same statuses, and no code uses 410, 422 or 429, and only `FORBIDDEN_ORIGIN` uses 403

### Requirement: Input validation (FR-X-3)
The `validate()` middleware SHALL parse the request params, query and body with the given shared Zod schemas. A failure SHALL be rejected with `400 VALIDATION_ERROR` and one `details` entry per issue, each with a dotted `field` path, and the handler SHALL NOT run. Parsed values SHALL be stored in `res.locals.valid`.

#### Scenario: S-AB1001-06 failed validation returns 400 VALIDATION_ERROR with field details
- **WHEN** a request body has an invalid nested email and a wrong-typed number
- **THEN** the response is `400` with code `VALIDATION_ERROR` and details whose fields are `user.email` and `age`

### Requirement: Secrets are not logged (FR-X-4)
Request logs SHALL NOT contain the values of the `Authorization` header, the `Cookie` header, the `Set-Cookie` response header, or the `password`, `newPassword`, `otp` and `refreshToken` body fields.

#### Scenario: S-AB1001-08 request logs do not contain the Authorization value
- **WHEN** a request carries the header `Authorization: Bearer super-secret-token`
- **THEN** the request is logged with its URL and the token value appears nowhere in the log output

### Requirement: PostgreSQL 16 through Prisma (AC-SETUP-02)
The backend SHALL reach PostgreSQL 16 through Prisma 7 with the `@prisma/adapter-pg` driver adapter.

#### Scenario: S-AB1001-09 backend connects to PostgreSQL 16 through the pg adapter
- **WHEN** the backend creates its Prisma client for the test database and runs a query
- **THEN** the query succeeds, the database is `noteapp_test`, and the server major version is 16
