# Contributing

## Scope

This repository contains the Angular 19 frontend for EDMS/PDF Searcher, plus the
`examination-service` (Spring Boot) and `ingest-service` (Node) backends. Keep
changes focused, preserve the existing Angular Material UI, and do not introduce
a visual redesign unless it is explicitly requested.

## Local workflow

1. Run `npm start` and use `http://localhost:4200`.
2. Run `npm run lint` and `npm run build` before opening a pull request.
3. Run `npm run test:ci`.
4. Add or update Jasmine tests when changing behaviour.

The frontend reaches the local Spring Boot service through `/api`; do not
hard-code `localhost:8082` into components.

## Where code goes

Code is organised **by feature**, not by file type and not by role. A user's role
is an access-control concern: it belongs in a route guard, never in a folder
name. Moving a screen from admin to user should change one `data: { role }`
annotation, not a directory.

```
src/app/
├── core/          app-wide singletons, instantiated once
│   ├── auth/        auth service, guard, token storage
│   ├── http/        interceptors: auth, error, correlation id
│   ├── config/      typed configuration and feature flags
│   └── logging/     logger abstraction (no bare console calls)
│
├── shared/        stateless and reusable, with no feature dependencies
│   ├── ui/          presentational components (inputs and outputs only)
│   ├── pipes/
│   ├── directives/
│   └── models/      cross-cutting contracts only
│
├── features/      one folder per business capability
│   ├── auth/
│   ├── compliance/
│   ├── dashboard/
│   ├── discrepancy/
│   ├── document-reader/
│   └── masters/     departments, document types, users, products
│
└── layout/        the application shell: page layout, sidebar, topbar
```

Every feature has the same internal shape. `features/discrepancy/` is the
reference; copy it.

```
features/<name>/
├── data-access/      services, HTTP calls, state
├── models/           types owned by this feature
├── ui/               dumb components
├── pages/            routed components
└── <name>.routes.ts  this feature's own routes and guards
```

### The dependency rule

```
features  ->  shared  ->  core
```

Imports point one way only. A feature must never import from a sibling feature;
if two features need the same thing, it moves into `shared/` (when stateless) or
`core/` (when it must be a singleton). This is enforced by ESLint in
`eslint.config.js`, so a violation fails the build rather than being caught in
review.

### Import cross-layer code through an alias, not a relative path

`tsconfig.json` defines `@core/*`, `@shared/*`, `@features/*`, `@layout/*` and
`@env/*`. Use them whenever an import leaves the current folder:

```ts
import { AuthService } from '@core/auth/auth.service';   // yes
import { environment } from '@env/environment';          // yes

import { AuthService } from '../../../core/auth/auth.service';  // no
```

This is not only cosmetic. ESLint's `no-restricted-imports` matches the import
string exactly as written, so a sideways `../../compliance/data-access/x` does
not contain the word `features` and slips straight past the boundary rule. The
alias names the layer, which makes the direction checkable. A relative climb of
`../../` or further from inside a feature is therefore itself a lint error.
Relative imports *within* one folder tree (`./x`, `../models/y`) remain correct.

### Backend layout

`examination-service` is being organised the same way — by feature, not by layer.
A `compliance/` package that owns its controller, DTOs, model, repository and
service can be lifted into its own service by moving one folder. A `service/`
package holding thirteen unrelated classes cannot.

```
com.edms.examination/
├── compliance/   discrepancy/   extraction/   vessel/
│   ├── api/        controller and DTOs: the only public surface
│   ├── domain/     model and business rules
│   ├── infra/      repositories and external API clients
│   └── <Name>Service.java
└── shared/
    ├── config/     @ConfigurationProperties classes
    ├── error/      GlobalExceptionHandler and problem responses
    ├── security/   filter chain and API-key authentication
    └── logging/    correlation-id filter
```

## Code conventions

- Use strict TypeScript; avoid `any` unless an external API genuinely has no
  stable type.
- Keep HTTP calls in a service, not in a component. A component that exceeds
  roughly 300 lines is doing more than one job.
- Never log credentials, JWTs, or raw document contents. `no-console` is a lint
  warning for exactly this reason — route diagnostics through `core/logging`.
- Delete superseded code instead of commenting it out; git already keeps it.
- Use the existing standalone-component and SCSS patterns.

## Migration status

The directory skeleton, lint boundaries and CI exist. Existing code has not moved
yet, so `core/services` and `pages/ADMIN|USER|AUTH` are still populated and are
still the correct place to look. Migrate opportunistically: when you touch a
screen, move it into its feature folder in the same pull request.

Three things are deliberately loosened so that CI is green from day one:

- **`anyComponentStyle` error budget was raised from 10 kB to 16 kB.**
  `npm run build` was already failing before any of this was added:
  `document-scanner.component.scss` is 10.02 kB against a 10 kB hard limit, so
  the production build exited non-zero. The warning threshold is still 8 kB, so
  the breach stays visible. Lower the error budget back to 10 kB once that
  component is split.

- **`npm run format:check` is not in CI.** The codebase predates Prettier. Run
  `npm run format` once, commit that on its own, then add the check to
  `.github/workflows/ci.yml`.
- **The secret scan is `continue-on-error`.** The demo database export under
  `examination-service/demo-data/db-export/` no longer contains real password
  hashes — they were replaced with hashes of one documented throwaway password —
  but the originals are still reachable through `git log`. Make this job blocking
  once the history is rewritten. See gap 7 below.

### Lint warning budget

`npm run lint` currently reports **0 errors and 129 warnings**. Every warning is
a rule that should eventually be an error; each is held at `warn` only because
existing code violates it. Promote a rule in `eslint.config.js` as soon as its
count reaches zero, and do not let these numbers grow:

| Rule | Count |
|---|---|
| `no-useless-escape` (extraction regexes) | 47 |
| `@typescript-eslint/no-explicit-any` | 29 |
| `@typescript-eslint/no-unused-vars` | 25 |
| `no-console` | 14 |
| `@typescript-eslint/array-type` | 4 |
| template accessibility (2 rules) | 4 |
| `no-empty-function` / `no-inferrable-types` | 4 |
| `no-empty-lifecycle-method`, `component-class-suffix` | 2 |

### Known gaps, in priority order

#### Security — fixed

These were the P0 findings. Each is fixed and verified; the note says how, so a
future change does not quietly undo it.

1. ~~`ApiService.postData` logged its request body, and login goes through it, so
   the login id and plaintext password reached the browser console.~~ Fixed.
   `postData` and `postWithToken` now log the URL only, through
   `core/logging/logger.ts`, which is also silent outside `isDevMode()`.
   Verified by signing in with the dev tools open: the console shows
   `POST → /api/login` and nothing else. **Never log a request body from
   `ApiService` — login shares that method.**
2. ~~`examination-service` had no authentication; port 8090 accepted any request,
   including the sanctions CSV import.~~ Fixed by `ApiKeyAuthFilter` +
   `SecurityProperties`, and by `server.address` defaulting to `127.0.0.1`.
   Verified: with `EXAMINATION_API_KEY` set, a request with no key and a request
   with a wrong key both return 401 and the correct key returns 200; `netstat`
   confirms the listener is on `127.0.0.1`, not `0.0.0.0`.
3. ~~`attachAuthToken: false` was the default and `environment.prod.ts` was
   unreachable, so a production build compiled the development environment.~~
   Fixed by the `fileReplacements` entry in `angular.json`.
   `environment.prod.ts` uses relative paths and `attachAuthToken: true`.
   Verified by grepping the production bundle: it contains
   `apiUrl:"/api",examineApiUrl:"/examine",attachAuthToken:!0` and no absolute
   API host.
4. ~~`ingest-service` had no key check and bound to every interface, while
   `POST /ingest` writes records into the DMS.~~ Fixed by `requireApiKey` and
   `INGEST_BIND`, defaulting to `127.0.0.1`. Verified: no key and wrong key both
   return 401, the correct key reaches the handler, `/health` stays open.
5. ~~The demo database export carried the real bcrypt hashes of twelve accounts,
   including named people.~~ Rewritten by
   `examination-service/demo-data/regenerate-demo-passwords.js`. Every demo
   account now uses the documented throwaway password in
   `deploy/README-SETUP.md`.

Both API keys are deliberately **off by default**. Each service logs a warning
at startup when its key is unset, and each is safe unset only because it binds
to loopback. Turning either key on means setting it in the service *and* in
whatever proxies to it — `proxy.conf.js` in development, the reverse proxy in
production. Never put either key in the Angular bundle: anything compiled into
the browser is readable in the network tab and is not a secret.

#### Security — outstanding

6. **The JWT is kept in `localStorage`, readable by any XSS.** A bank deployment
   wants an httpOnly `SameSite=Strict` cookie. *This one cannot be fixed from
   this repository.* The demo build of the DMS JAR returns the token in a JSON
   response body, so the browser has to receive it in JavaScript and put it
   somewhere itself; an httpOnly cookie has to be set by the server that issues
   the token. Fixing it needs a change on the DMS side — the login endpoint
   setting `Set-Cookie` instead of, or alongside, returning the token — and then
   removing the `localStorage` write here. Moving it to `sessionStorage` is not
   a fix: it is still script-readable and would only make the gap harder to see.
7. **The old password hashes are still in git history.** Finding 5 replaced them
   in the working tree, but `git log -p` still shows the originals, so the
   secret scan in CI stays `continue-on-error`. Clearing them means rewriting
   history on a shared branch, which invalidates every existing clone — do not
   do it without agreeing it with everyone working on the repository first.

Correctness and structure:

8. All seventeen frontend `.spec.ts` files are untouched CLI stubs. There is no
   controller or integration test on the backend, and `DiscrepancyService` has no
   coverage.
9. `document-scanner.component.ts` is 1781 lines across roughly forty methods,
   covering upload, OCR, canvas interaction, screening, vessel tracking, DMS
   filing and report generation.
10. `ingest-service` imports frontend services through a fake `@Injectable`
    decorator in `shims/`. Shared logic belongs in a real workspace package.
11. Backend routes are unversioned; prefer `/api/v1/...` before an external
    consumer binds to them.
12. Configuration is read through scattered `@Value` annotations with no startup
    validation. `SecurityProperties` is the first `@ConfigurationProperties`
    class and is the pattern to follow for the rest.
13. `ARCHITECTURE.md` and `PROJECT_ARCHITECTURE.md` overlap and should be one
    document. `src/app/components/` is empty and can be deleted.

## Commits and reviews

Describe user-visible behaviour, backend-contract changes, and tests run. Do not
commit `node_modules`, `dist`, browser storage, or local environment values.
