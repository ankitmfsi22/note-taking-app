## ADDED Requirements

### Requirement: Loading fallback for lazy routes (SDS 9.1, SA-35)
Pages are loaded with route-level `lazy`. The frontend SHALL show a loading fallback while React Router loads the lazy route that matches the first URL, so the first render is never empty and React Router raises no missing-`HydrateFallback` warning.

#### Scenario: S-AB1001-31 a loading fallback is shown while the first lazy route loads
- **WHEN** the application is opened at `/`
- **THEN** the text `Loading…` is shown first, and the home page heading `Note App` replaces it once the route has loaded
