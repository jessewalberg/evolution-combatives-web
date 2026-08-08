# Playwright visual regression

Phase 4 of the testing initiative (GitHub issue #20).

These tests screenshot top-level admin and public pages with `toHaveScreenshot`.
API and Supabase REST responses are mocked via Playwright `page.route()` so
snapshots do not depend on live shared-project data.

Live-data E2E flows remain under `e2e/tests/` - see `e2e/README.md`.

## Viewports

| Name | Width | Height | Projects |
|------|-------|--------|----------|
| desktop | 1440 | 900 | `visual-public-desktop`, `visual-authed-desktop` |
| mobile | 390 | 844 | `visual-public-mobile`, `visual-authed-mobile` |

Chromium only. WebKit is not part of the visual suite (separate font baselines).

## Tagging and discovery

Every visual test title includes `@visual`. Discover or run with:

```bash
pnpm exec playwright test --grep @visual --list
pnpm test:e2e:visual
```

Public pages use the `visual-public-*` projects (empty storageState).
Authenticated pages use `visual-authed-*` and depend on the existing `setup`
project (`e2e/.auth/admin.json`).

## Determinism

- Fixed fixture IDs and timestamps in `fixtures.ts`
- `page.clock.install` at a fixed instant
- Seeded `Math.random` (analytics / processing mock metrics)
- Masked relative-time / "Last updated" regions and Recharts containers
- Third-party noise aborted (PostHog, Cloudflare Stream iframes, remote images)

## Baseline rule (critical)

Screenshot baselines are **Linux CI / Playwright Docker only**.

Font rendering differs by OS. Baselines generated on macOS will fail on the
GitHub Actions `ubuntu-latest` runner as noisy diffs.

**Never** run `pnpm test:e2e:visual:update` on macOS (or any non-matching
platform) and commit the result.

## Scripts

```bash
pnpm test:e2e:visual          # compare against committed baselines
pnpm test:e2e:visual:update   # rewrite baselines - Linux only
```

## Regenerating baselines (preferred: Docker)

Docker must match the resolved `@playwright/test` version in this repo.

1. Confirm the version:

```bash
pnpm exec playwright --version
# example: Version 1.62.1
```

2. Populate gitignored `.env.test.local` (same as live E2E - see `e2e/README.md`).

3. Run the helper (pulls `mcr.microsoft.com/playwright:v<VERSION>-jammy`):

```bash
./e2e/visual/scripts/update-baselines-docker.sh
```

The container's `node_modules` is backed by a named Docker volume
(`evolution-combatives-visual-node-modules`), not the live bind-mounted repo
directory, so a Linux `pnpm install` inside the container never overwrites
the host's macOS `node_modules`. If the volume gets into a bad state, remove
it with `docker volume rm evolution-combatives-visual-node-modules` and
re-run the script.

4. Review the updated `e2e/visual/**/*-snapshots/*.png` files and commit them.

## Regenerating baselines (fallback: GitHub Actions)

If Docker cannot run locally, use workflow dispatch:

1. Open **Actions** → **E2E** → **Run workflow**.
2. Select branch `playwright-visual-regression-suite` (or your PR branch).
3. Set **Update visual baselines** to `true`.
4. Wait for the `visual-baselines` job.
5. Download the `visual-baselines` artifact.
6. Extract the `*-snapshots/` PNGs into `e2e/visual/` in the worktree.
7. Commit the PNGs on that branch.

## Pages covered

- Public: login, sign-up, subscribe, subscription-success
- Dashboard home (populated + empty metrics)
- Content: disciplines, categories, videos, processing (populated + empty),
  video upload, video edit, video preview
- Users list (populated + empty) and user detail
- Analytics (populated + empty; charts masked)
- Q&A list (populated + empty) and Q&A detail

Intentionally skipped: `/` (redirects to dashboard), `forgot-password`,
`reset-password`, `auth/confirm`.
