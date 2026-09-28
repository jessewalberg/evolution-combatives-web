# Playwright E2E

Phase 3 of the testing initiative (GitHub issue #19). These tests run against the shared Supabase project and Stripe test-mode keys used by preview/staging. Treat data hygiene as mandatory.

## Prerequisites

- Node.js 22.22.2+ (or 24.15.0+, or 26+) and pnpm 11.7.0 (see `package.json`)
- 1Password CLI (`op`) signed in for local secret loading
- Playwright browsers: `pnpm exec playwright install chromium webkit`

## Credentials (local)

This repo never stores raw secrets. Populate a **gitignored** `.env.test.local` at the repo root for Playwright and Vite, and `.dev.vars` for the local Worker runtime. The Worker does not inherit server secrets from the Playwright process. Use `.env.example` and `.dev.vars.example` for the respective variable names.

Vault / item for local-dev:

- Vault: `evolution-combatives-web-app`
- Item: `preview`

Per field:

```bash
op read "op://evolution-combatives-web-app/preview/VITE_SUPABASE_URL"
# …repeat for each field, or:
op item get preview --vault evolution-combatives-web-app
```

Use the `VITE_*` values from `.env.example` in `.env.test.local`, together
with `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and
`STRIPE_SECRET_KEY` for fixture cleanup. Set the Worker values from
`.dev.vars.example` in `.dev.vars`. CI supplies its process variables through
`.github/workflows/e2e.yml` and writes `.dev.vars` before starting the Worker.

E2E-only credentials (admin user used by the auth setup project):

| Variable | Purpose |
|----------|---------|
| `E2E_ADMIN_EMAIL` | Super-admin (or content-capable admin) for `storageState` |
| `E2E_ADMIN_PASSWORD` | Password for that user |

`playwright.config.ts` loads `.env.test.local` via `dotenv`. Never print secret values into logs, screenshots assertions, or commit them.

## CI credentials

`.github/workflows/e2e.yml` reads **plain GitHub Actions secrets** with the same names as the env vars above (plus `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`). It does **not** invoke the 1Password CLI. Populating those repo secrets is the repo owner's job (values live in vault `evolution-combatives-web-ci` / item `preview`).

Fork PRs are skipped (`head.repo.full_name == github.repository`) because secrets are unavailable.

## Scripts

```bash
pnpm test:e2e          # headless live-data suite (chromium + webkit)
pnpm test:e2e:ui       # Playwright UI mode
pnpm test:e2e:headed   # headed browsers
pnpm test:e2e:visual   # visual regression suite (mocked routes, Chromium)
```

Visual regression docs and Linux-only baseline workflow: [`e2e/visual/README.md`](./visual/README.md).

Local faster iteration (dev server instead of production build):

```bash
E2E_WEB_SERVER_COMMAND="pnpm dev" pnpm test:e2e
```

## Data hygiene

Every test that creates data must:

1. Use unique identifiers (`e2e/helpers/unique.ts` - timestamp + UUID suffixes).
2. Tear down in `afterEach` / `afterAll` via the app's admin/content APIs when they exist (`DELETE /api/content/...`, `POST /api/admin/content` bulk delete).
3. Fall back to the Supabase service-role client only when no product API exists (auth users, subscription rows, Q&A questions/answers).

Do not depend on fixed seed rows. Do not leave orphaned fixtures in the shared project.

## Layout

```
e2e/
  setup/auth.setup.ts     # real /login → e2e/.auth/admin.json
  helpers/                # unique IDs, CSRF, API, service-role cleanup
  tests/*.spec.ts         # live-data flow specs
  visual/                 # mocked visual regression suite (see visual/README.md)
  README.md               # this file
playwright.config.ts      # webServer, chromium + webkit + visual projects
```
