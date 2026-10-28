# ADR-0003: Token strategy (JWT in memory, rotating refresh cookie)

- Status: Proposed (approved together with `docs/SDS.md`)
- Date: 2026-10-28
- Tickets: AB-1002, AB-1003, AB-1010
- SDS: Sections 5.1 to 5.3, 9.3

## Context

The assignment fixes a 15-minute JWT access token and a 7-day refresh token stored in the database. The FRS requires rotation (AC-AUTH-07), rejection of used tokens with revocation of all the user's refresh tokens (AC-AUTH-08, AC-AUTH-12), logout that revokes the presented token (AC-AUTH-09), and a session that survives page reload (AC-FEAUTH-05). Where tokens live in the browser is left to the SDS (FRS A-32).

## Decision

- **Access token:** JWT, HS256, 15 minutes, signed with `JWT_ACCESS_SECRET`, verified with `jose` using an algorithm allow-list plus issuer and audience. The browser keeps it in JavaScript memory only.
- **Refresh token:** opaque 256-bit random value. The database stores only `SHA-256(token)`. It is delivered in an `HttpOnly`, `SameSite=Strict` cookie with `Path=/api/v1/auth`, and `Secure` in production.
- **Rotation:** `POST /auth/refresh` revokes the presented token and issues a new one in one transaction, using a compare-and-set update so two concurrent calls cannot both succeed.
- **Session restore:** on app start the SPA calls `/auth/refresh`. The cookie is sent automatically, and the response carries a fresh access token and the user.
- **CSRF:** the cookie is used only by `/auth/refresh` and `/auth/logout`. They are protected by `SameSite=Strict` and an Origin check.
- **Reuse detection (family revocation):** presenting a token that is found with `revokedAt` set revokes every active refresh token of that user, commits, then returns `401 INVALID_REFRESH_TOKEN` (AC-AUTH-12). Unknown or merely expired tokens return the same `401` and revoke nothing.
- **Single flight:** the SPA shares one in-flight refresh promise and uses the Web Locks API across tabs, so rotation never races with itself.

## Consequences

- XSS cannot read the refresh token (`HttpOnly`) or a stored access token (memory only). An XSS can still call the API while the page is open; the allow-listed rich text and the no-`innerHTML` rule reduce that risk.
- Access tokens cannot be revoked. After logout or password reset they remain valid for up to 15 minutes, which the FRS allows.
- Reload costs one refresh round trip before the first screen.
- A stolen refresh token that is used after the real client rotated it (or the reverse) signs the user out on every device, which limits the thief's window to the next refresh.
- A legitimate double refresh with one cookie (two tabs at once) is indistinguishable from reuse and also signs the user out everywhere. The single-flight promise and Web Locks prevent it, and a test proves it.
- A token revoked by logout that is presented again also counts as reuse and revokes the user's other sessions.

## Alternatives considered

- **Access token in `localStorage`:** rejected; readable by any script on the page.
- **Refresh token in `localStorage` or in the JSON body:** rejected for the same reason.
- **Only reject a reused token, revoking nothing else:** the first draft of this ADR chose it because the original FRS only said "reject". Replaced after review by family revocation (AC-AUTH-12), which detects theft.
- **Grace window for concurrent refreshes (for example 10 seconds):** would avoid the two-tab logout, but adds state and a weaker rule. Not chosen; the Web Locks single flight handles the case.
- **`jsonwebtoken`:** rejected in favour of `jose` (zero dependencies, maintained, explicit algorithm handling).
- **Server-side sessions:** rejected; the assignment fixes JWT plus refresh tokens.
