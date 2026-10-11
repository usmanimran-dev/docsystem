# Frontend agent notes

- This is Angular 19, not Next.js.
- Preserve the existing UI and route layout; do not redesign pages during maintenance work.
- Use `/api` environment URLs and the dev proxy for backend calls.
- Never expose passwords, JWTs, or other stored secrets in code, logs, tests, or documentation.
- Keep backend contracts typed in `src/app/core/models` and API calls in `src/app/core/services`.
- Before handoff, run the production build and relevant Jasmine/Karma tests.
