# Architecture

## Overview

PDF Searcher is an Angular 19 standalone frontend. It communicates with the local EDMS Spring Boot backend through the Angular development proxy.

```
Browser -> Angular (:4200) -> /api proxy -> Spring Boot (:8082) -> MongoDB (:27017)
```

## Frontend structure

- `src/app/pages` — routed business screens, grouped by `AUTH`, `ADMIN`, and `USER`.
- `src/app/components` — reusable or feature-specific UI components.
- `src/app/core/services` — HTTP, authentication, OCR, duplicate detection, and analysis services.
- `src/app/core/models` — TypeScript representations of backend request/response data.
- `src/app/core/guards` and `interceptors` — authentication and request security.
- `src/environments` — API base URL configuration.

## Routing and security

`app.routes.ts` defines lazy-loaded standalone pages under `PageLayoutComponent`. `authGuard` blocks unauthenticated navigation; pages with `data.role` additionally require the matching `ADMIN` or `USER` role. Backend authorization remains the source of truth.

## API boundary

`ApiService` owns EDMS HTTP calls. Environment URLs use `/api`, which `proxy.conf.json` forwards to `http://localhost:8082` during development. JWT attachment and expired-session handling happen in `authInterceptor`.

## Document Reader

Document Reader currently performs local preview and browser-side analysis. Its duplicate history uses browser local storage and is not an EDMS/Mongo record. Persisted document upload and server-side duplicate checks require a dedicated backend endpoint.

## Quality baseline

The repository currently uses Angular's Jasmine/Karma tests. Checkstyle, SpotBugs, PMD, JUnit, Mockito, and JaCoCo apply to the Java backend/parser, not this TypeScript frontend. Tooling additions such as ESLint, Prettier, and SonarQube are deliberately deferred.
