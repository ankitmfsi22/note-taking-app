# api-docs Specification

## Purpose
Defines the browsable, always-correct description of the REST API: a complete OpenAPI 3.1 document, served as Swagger UI and as JSON, and kept in sync with the registered routes by a test.

## Requirements

### Requirement: The OpenAPI document is valid and covers every endpoint (SDS 7.1, SA-44)
`docs/api/openapi.yaml` SHALL be a valid OpenAPI 3.1 document with the server URL `/api/v1`, the `bearerAuth` (HTTP bearer JWT) and `refreshCookie` (API key in cookie `refresh_token`) security schemes, and an operation for every route registered on the Express app, each with its binding statuses and the shared error body.

#### Scenario: S-AB1016-06 the document is valid OpenAPI 3.1
- **WHEN** the document is validated with `@apidevtools/swagger-parser`
- **THEN** validation succeeds, the version is `3.1.0`, the server URL is `/api/v1`, and both security schemes exist

#### Scenario: S-AB1016-07 every registered route is documented and nothing else is
- **WHEN** the routes are read from the real app router stack under `/api/v1` and compared with the `paths` of the document
- **THEN** every registered method and path is a documented operation, every documented operation is a registered route, and there are exactly 28

### Requirement: Swagger UI and the raw spec are served when enabled
When `API_DOCS_ENABLED` is true the backend SHALL serve Swagger UI at `/api/docs` and the document as JSON at `/api/docs/openapi.json`, both without authentication and outside `/api/v1`.

#### Scenario: S-AB1016-08 Swagger UI and the JSON spec are served without a token
- **WHEN** a client sends `GET /api/docs/` and `GET /api/docs/openapi.json` with no `Authorization` header
- **THEN** both answer `200`, the first as HTML and the second as JSON equal to the parsed YAML

#### Scenario: S-AB1016-09 the docs are not mounted when the flag is off
- **WHEN** `API_DOCS_ENABLED` is `false` and a client sends `GET /api/docs/` and `GET /api/docs/openapi.json`
- **THEN** both answer `404` with `error.code` `ROUTE_NOT_FOUND`

### Requirement: Mounting the docs does not change the API
The docs router SHALL NOT alter authentication, validation or error handling of `/api/v1`.

#### Scenario: S-AB1016-10 the API still rejects anonymous and invalid requests
- **WHEN** docs are enabled and a client sends `GET /api/v1/notes` without a token, and `POST /api/v1/auth/login` with an empty body
- **THEN** the first is `401` with `error.code` `UNAUTHORIZED` and the second is `400` with `error.code` `VALIDATION_ERROR`

### Requirement: `API_DOCS_ENABLED` is validated configuration
The backend `Env` schema SHALL accept `API_DOCS_ENABLED` as `true` or `false`, defaulting to `true` when `NODE_ENV` is `development` or `test` and to `false` when it is `production`, and SHALL reject any other value at startup.

#### Scenario: S-AB1016-11 the flag defaults by environment and rejects bad values
- **WHEN** the environment is loaded with no flag for each `NODE_ENV`, with `API_DOCS_ENABLED=false`, and with `API_DOCS_ENABLED=maybe`
- **THEN** the default is `true` for development and test and `false` for production, `false` is honoured, and `maybe` throws an error naming `API_DOCS_ENABLED`

### Requirement: The adjusted CSP applies to the docs only
The `Content-Security-Policy` for `/api/docs` SHALL differ from the Helmet default only by dropping `upgrade-insecure-requests` (it stops Swagger UI loading over plain http); every other route SHALL keep the Helmet default.

#### Scenario: S-AB1016-12 only the docs get the adjusted policy
- **WHEN** a client requests `GET /api/docs/` and `GET /api/v1/health`
- **THEN** the docs policy has no `upgrade-insecure-requests` and the health policy keeps it, and both keep `script-src 'self'`
