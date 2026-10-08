# AGENTS.md — Evolution Combatives Admin Dashboard

## What this product is
- **Product:** Evolution Combatives admin dashboard — tactical training video management, user administration, analytics, and Q&A moderation for a React Native mobile app. TanStack Start on Cloudflare Workers with Supabase auth/DB, Cloudflare Stream video, and Stripe subscriptions.
- **Live URL:** https://evolutioncombatives.com   **Previews:** Workers Preview URLs on evolution-combatives-admin-preview.jesse-6b1.workers.dev
- **Stage:** Client (paying)   **Current goal:** Cut over from Vercel to Cloudflare Workers
- **Owner:** Jesse. Jesse is the only person who merges. Merging to `main` is the production deploy.

## Required skills (MANDATORY: load before writing or reviewing code)
| Skill | When |
|---|---|
| `cloudflare` | Choosing any Cloudflare product or architecture |
| `wrangler` | Any Wrangler command, config, binding, secret, Preview, or deploy question |
| `workers-best-practices` | Writing or reviewing any Worker code |
| `security-audit` ([cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)) | See "Security audit" below |

Skills are installed at pinned versions (see `.cursor/skills/*-VERSION` files). Do not upgrade a skill in a feature PR.
Cloudflare APIs change, so retrieve current docs (Cloudflare docs MCP or developers.cloudflare.com) instead of relying on memory.

## Hard rules (never break these)
1. **Never merge, approve, or deploy.** Open a PR and stop. Never run `wrangler deploy`, `cf deploy`, `wrangler secret put`, or `wrangler versions deploy`. Workers Builds deploys on Jesse's merge.
2. **Never push to `main`.** Work only on your own branch (`cursor/<short-topic>-<suffix>` or `agent/<short-topic>`). Workers Builds turns your pushed branch into a Preview automatically.
3. **No Cloudflare credentials.** You have none and must not ask for any. If a resource needs creating or changing (KV, R2, Queue, DNS), put the exact `cf ... --dry-run` or `wrangler ...` command in the PR under "Commands for Jesse".
4. **Never touch production data.** Previews bind only to the staging Supabase project (`hknjeztslvbenmlaqfqa`) and Stripe test mode. Never point a Preview, test, or script at the production database (`bxpxpkiubjbcmgsnfpvp`), live Stripe keys, or production Stream videos.
5. **Never touch secrets.** Never read, print, log, commit, or request a secret or `.env` value. List any new secret by name in the PR.
6. **No employer anything. No children's or family data** in code, content, fixtures, analytics, or logs.
7. **No unverifiable claims** in copy: no guarantees, testimonials, statistics, savings, or deadlines without a cited source.
8. **No outward actions:** no emails, posts, purchases, domain or DNS changes, plan changes, or new third-party accounts.
9. **No self-repair loops.** If the same task or check fails twice, stop and report. Never add workflows, bots, crons, or schedules that trigger agents.
10. **Stay in scope.** Note anything else you find under "Found, not fixed".

## CLI rules
- This repo has `wrangler.jsonc`, so use the **project's own Wrangler** (`pnpm wrangler ...`) for dev, types, and Previews.
- Use **`cf`** (Cloudflare CLI, beta) only for read-only lookups and account/resource questions: `cf cli search "<task>"`, then `cf schema ...`, then `--dry-run`. **Never run `cf dev`, `cf build`, `cf deploy`, or `cf migrate` here.**
- After any config or binding change, run `pnpm wrangler types` and `pnpm wrangler deploy --dry-run` (a packaging check only; it deploys nothing).

## Stack notes (this product differs from all-Cloudflare standard)
- **Runtime:** Workers + TanStack Start SSR via `@cloudflare/vite-plugin`
- **Database:** Supabase Postgres (NOT D1). Production: `bxpxpkiubjbcmgsnfpvp`. Staging/preview: `hknjeztslvbenmlaqfqa`. Schema and RLS policies are managed externally; never run migrations against production.
- **Auth:** Supabase Auth with `@supabase/ssr` cookie-based sessions (NOT Better Auth/D1). Admin roles stored in `profiles.admin_role`.
- **Video:** Cloudflare Stream with signed URLs. Signing keys required; playback fails closed (503) without them.
- **Payments:** Stripe Checkout. Test keys in staging/preview; live keys in production (configured via wrangler secrets).
- **Access:** Cloudflare Access already protects staging (`evolution-combatives-admin-staging.jesse-6b1.workers.dev`) and preview (`*evolution-combatives-admin-preview.jesse-6b1.workers.dev`) Workers. CI uses service token `evolution-combatives-ci`.
- **Package manager:** pnpm only; never edit the lockfile by hand.

```bash
pnpm install --frozen-lockfile
pnpm dev                 # local dev
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # all must pass
```

## Workers rules (from workers-best-practices; flag violations in review)
- Generated `Env` types only (`wrangler types`); no hand-written `Env`, no `any` on bindings.
- Use `crypto.randomUUID()` / `crypto.getRandomValues()` for tokens, never `Math.random()`. Compare secrets with constant-time comparison.
- No module-level mutable request state. Every async task is awaited, returned, or passed to `ctx.waitUntil()`.
- Stream large bodies instead of buffering them. Use bindings, not the Cloudflare REST API, from inside Workers.
- Authorization lives in the Worker. Every query that reads or writes user data checks who is asking.

## Security audit (mandatory)
- **Before the first production deploy** of a new or migrated project, and before any auth or data migration cutover: run the `security-audit` skill in full-audit mode **twice** (runs build on each other, and one run finds about half).
- **Any PR touching auth, sessions, payments, webhooks, file access, or data permissions:** run it in focused (guidance) mode on the changed area, and summarize the result in the PR.
- **Monthly** for every live repo with users or payments (Jesse's scheduler triggers this; agents never schedule it themselves).
- Write reports **outside the repo** to the private audit location `~/security-audit-skill/evolution-combatives-web/`. Never commit findings or paste exploit details into PRs or public places.
- A **confirmed high or critical** finding blocks merge until a fix PR lands. `needs_validation` findings are listed in the PR for Jesse.
- Never run target code outside an isolated, no-network sandbox. If none is available, leave leads as `needs_validation`.

## Pull request rules
- One purpose per PR, **≤ 400 changed lines** (excluding lockfiles and generated files), and **≤ 2 open agent PRs** per repo.
- The description must include: **What / Why / How I verified it / Preview URL / Security notes / Commands for Jesse / Found, not fixed**.
- Required checks green: `typecheck`, `lint`, `test`, `build`, and the Workers Builds Preview build.
- Logic changes come with tests. Never delete or skip a test to get green. New dependencies need a one-line justification.

## Measurement (same events in every product)
`page_viewed` · `cta_clicked` (prop `cta`) · `signup` · `checkout_started` · `payment_succeeded` (server-side, from the Stripe webhook).
No personal data (emails, names, addresses) in event properties.

## Where things are
- `src/routes/` pages and API routes · `src/server/` Worker API handlers and authorization · `src/services/` business logic
- `wrangler.jsonc` production config plus staging and preview environments
- `.cursor/skills/` vendored skills with version files

## Known gotchas
- With the Cloudflare Vite plugin, the environment is chosen by `CLOUDFLARE_ENV` at build time, not by `wrangler deploy --env`.
- Previews don't run Cron Triggers or Queue consumers. Test scheduled logic through a test-only route on the Preview URL.
- Preview URLs are protected by Cloudflare Access. CI uses service token headers (`CF-Access-Client-Id`, `CF-Access-Client-Secret`).
- Supabase service role key must NEVER be used in browser code; `createAdminClient()` throws if called client-side.
- Stream signed URLs fail closed (503) if signing keys are missing — this is intentional to prevent free video access.
