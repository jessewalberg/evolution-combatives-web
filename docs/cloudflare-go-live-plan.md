# Cloudflare Workers go-live plan (evolutioncombatives.com + www)

Written 2026-10-12. Starting point: PR #38 (`cursor/workers-migration-consolidated-2bf4`).

Jesse's decisions this plan carries:

- [J 2026-10-12] "No it should not run we are getting rid of vercel this should be on cloudflare now." Vercel will not be fixed. The site moves to Cloudflare Workers.
- [J 2026-10-09] No unit tests. Do not create, run, maintain or recreate them, including in CI. Verification uses build, typecheck, lint, Playwright E2E, real-surface checks and independent review. Any check that is skipped is recorded as not run.

## State on 2026-10-12 (observed)

- `https://evolutioncombatives.com/`, `https://www.evolutioncombatives.com/api/health` and `https://evolutioncombatives.com/api/webhooks/stripe` all return `402 DEPLOYMENT_DISABLED` from Vercel. The Stripe and Stream webhooks and the mobile API are failing along with the site.
- DNS is already on Cloudflare (nameservers `anita`/`matias.ns.cloudflare.com`). The apex `A` record and the `www` CNAME still point at Vercel. `testing.evolutioncombatives.com` is also a CNAME to Vercel. Source: dns.google lookups.
- The GitHub `Production` environment requires a review from `jessewalberg` before any deploy job runs. Source: the repo's environments API. Its secret names could not be read (403 from the API).
- The production mobile build (`eas.json` profile `production` in `evolution-combatives-mobile`) calls `https://www.evolutioncombatives.com` for `/api/mobile/video/signed-url`, `/api/mobile/subscriptions/create-checkout` and `/api/mobile/subscriptions/portal`. Those calls are POSTs. That means **www must be served directly, with no www→apex redirect**: redirected POSTs and Stripe deliveries fail.
- PR #38: the Typecheck, Lint, Test, Playwright E2E and Preview checks pass. Nobody has reviewed it. The PR body says the security audit is "in progress".
- `wrangler.jsonc` in PR #38 sets `STRIPE_PUBLISHABLE_KEY` and the three price IDs to `"update"`. The `src/` code never reads `STRIPE_PUBLISHABLE_KEY`, because web checkout was removed, so only the **three price IDs** block launch. Mobile checkout reads them through `SUBSCRIPTION_PRICING`, so with `"update"` every checkout fails.
- `deploy.yml` deploys production on every push to `main`. Each deploy still waits for the Production reviewer gate.
- `ci.yml` in PR #38 adds a `Test` job that runs `vitest run --coverage`. The PR also carries about 100 unit test files plus `.cursor/skills/security-audit/*.test.cjs`. Merging it as is would break the 2026-10-09 rule.

## Recommendation

Ship **one release PR**: PR #38 plus the launch fixes, the price IDs and the custom-domain routes. Jesse sets the secrets and removes the two Vercel DNS records just before he approves that deploy.

The two-phase deploy in `docs/GO-LIVE.md`, where the Worker goes up first and the domains are attached in a later PR, was meant to protect live traffic on Vercel. There is no such traffic now. Splitting the work adds a second review, merge and approval cycle, and it does not make the site safer. Every hour the site stays down, Stripe retries come closer to their limit.

## Ordered steps

| # | Step | Who | Jesse supplies |
|---|------|-----|----------------|
| 1 | Independent review of PR #38. The scope is auth, the mobile API, the Stripe and Stream webhooks, CSRF, rate limiting and secret handling. Output is a list of findings. | Navi sprite (read-only) | Optionally, the private security-audit results. If he has none, the sprite review covers the launch paths. |
| 2 | Release branch from the PR #38 head with these launch fixes (below), shipped through `no-mistakes`. The new PR supersedes #38. | Navi sprite | The three live-mode price IDs (not secret) |
| 3 | Cloudflare, GitHub and production Supabase prerequisites (below) | Jesse | Dashboard access only. No values go to Navi. |
| 4 | Worker secrets on `evolution-combatives-admin` | Jesse | Secret names below. He enters the values himself. |
| 5 | Stripe and Stream webhook checks (below). No new Stripe endpoint. | Jesse | Facts that are not secret: endpoint URL, API version, enabled state, earliest failed delivery |
| 6 | DNS: delete the apex `A` record and the `www` CNAME that point at Vercel, right before step 7 | Jesse | Cloudflare DNS access for the zone |
| 7 | Squash-merge the release PR, then approve the `Deploy` run in the Production environment | Jesse | A yes |
| 8 | Public smoke checks (below) | Navi sprite | None |
| 9 | Signed-in checks: video playback, checkout, webhook replay, reconcile (below) | Jesse | A device and the dashboards |
| 10 | Clean-up and Vercel shut-off (below), about 48 hours after step 9 passes | Jesse, then a Navi sprite for repo follow-ups | Vercel and Cloudflare access |

### Step 2: launch fixes (sprite)

Each fix is small, and each one closes a problem that would hit a normal path at cutover.

1. **Remove unit tests [J 2026-10-09].** Delete every `*.test.ts`, `*.test.tsx` and `*.test.cjs` file, including the two tests under `.cursor/skills/security-audit/`, plus `vitest.config.ts`, `vitest.setup.ts`, `test/`, the vitest and testing-library dev dependencies and the `test*` vitest scripts. Remove the `Test` job from `ci.yml`. Keep the non-test `.cursor/skills/` reference material, Typecheck, Lint, Playwright E2E and Preview.
2. **Make the Stripe webhook idempotent and order-independent** (`src/server/webhooks/stripe.ts`).
   - Route every `customer.subscription.*` and `invoice.payment_*` event through one per-member reconciliation boundary. Re-read the event's subscription and the customer's subscriptions from Stripe; select the member's current subscription from Stripe's live state (active or trialing first, then the newest remaining subscription). Reconcile only that selected ID, never a historical event's ID. Atomically guard the `(user_id, platform)` upsert against a stale selection replacing a newer current subscription. A delayed event for an old canceled subscription must leave a newer subscription row untouched, even when that old event arrives last or concurrently.
   - Derive status, tier and the `profiles.subscription_tier` write from the guarded current subscription, granting its tier only while active or trialing, including on invoice success/failure and cancellation. An invoice event must not set a historical subscription to `active` or `past_due`, and a cancellation must not clear the tier of a newer active subscription. If the guard rejects a stale event, neither table changes. The upsert target is `(user_id, platform)` because of the unique key `subscriptions_user_id_platform_key`.
   - Today `handleSubscriptionCreated` does a plain `insert`. That fails on any replay (unique `stripe_subscription_id`), and it fails for any member who subscribes again after cancelling (unique `user_id, platform`).
   - Read period fields from `items.data[0].current_period_*` when the top-level fields are missing. Read the invoice's subscription from `parent.subscription_details.subscription` when `invoice.subscription` is missing.
   - Never call `toISOString()` on `NaN`.
3. **Exempt `/api/webhooks/*` from the per-IP API rate limiter** (`src/start.ts`, 100 requests per 60 s per IP). The Stripe backlog replays from a few IPs and would hit 429s.
4. **`wrangler.jsonc`:** set the three production price IDs. Delete the unused `STRIPE_PUBLISHABLE_KEY` entries. Add the top-level routes:
   ```jsonc
   "routes": [
     { "pattern": "evolutioncombatives.com", "custom_domain": true },
     { "pattern": "www.evolutioncombatives.com", "custom_domain": true }
   ]
   ```
   The env blocks already set `routes: []`, so staging and preview do not inherit these.
5. **Docs:** fold the corrections from this plan into `docs/GO-LIVE.md`. That means the single release, www served directly, the token scope, and the fact that the Stream signing keys only gate the code (below).

Verification: `pnpm build` (vite build + tsc), `pnpm lint`, Playwright E2E and the preview deploy in CI. Unit tests are not run [J 2026-10-09].

### Step 3: Cloudflare, GitHub and production Supabase prerequisites (Jesse)

- Confirm the `evolutioncombatives.com` zone is in the **same Cloudflare account** as the Worker (the `account_id` in `wrangler.jsonc`). Custom domains cannot attach to a zone in another account.
- Confirm the **Stream library with the gym's videos is in that same account**. `CLOUDFLARE_ACCOUNT_ID` in `wrangler.jsonc` vars builds every Stream API URL, and `CLOUDFLARE_CUSTOMER_SUBDOMAIN` builds playback URLs. If Stream lives in another account, change those two vars in step 2. They are not secret.
- In the GitHub `Production` environment, set these secrets:
  - `CLOUDFLARE_ACCOUNT_ID`.
  - `CLOUDFLARE_API_TOKEN`: for this first deploy, a temporary account-owned token with **Workers Scripts: Edit** plus **Zone → Workers Routes: Edit** on the `evolutioncombatives.com` zone. A per-Worker token cannot attach custom domains.
- Supabase production project → Authentication → URL Configuration: check that `https://evolutioncombatives.com/**` and `https://www.evolutioncombatives.com/**` are allowed redirect URLs.
- Compare the production Supabase migration history with the checked-in `supabase/migrations/` files. Apply any pending production migrations in order before step 7, then verify that `public.subscriptions` has the Stripe columns and unique `stripe_subscription_id` index from `20260808000003_fix_stripe_subscription_columns.sql` and the `(user_id, platform)` constraint. PR #38's deploy workflow does not run migrations; do not approve cutover while this schema is missing.

### Step 4: Worker secrets (Jesse; names only)

Set these on `evolution-combatives-admin` with `wrangler secret put <NAME>` or in the dashboard (Worker → Settings → Variables and Secrets). If the Worker does not exist yet, `wrangler secret put` creates it.

| Secret | Source | Needed for |
|--------|--------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase production project → API | Webhooks, mobile entitlement, admin APIs |
| `STRIPE_SECRET_KEY` | Stripe live mode → API keys | Mobile checkout, webhook verification client |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the **existing** live endpoint | Stripe webhook |
| `CLOUDFLARE_API_TOKEN` | A Stream token with Stream: Edit on the Stream account. This is **not** the deploy token, although the name is the same. | Signed URLs, uploads, processing sync |
| `CLOUDFLARE_STREAM_SIGNING_KEY_ID` | Stream → signing keys | Gate: signed-URL code fails closed with 503 if it is missing |
| `CLOUDFLARE_STREAM_SIGNING_KEY` | Same | Same gate. The current code mints tokens through the Stream `/token` API with the API token and never signs with this key. |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | `GET /accounts/{id}/stream/webhook` returns it | Stream webhook |

The staging and preview secrets and the separate non-production Stream account are not needed to bring the site back. They come after launch.

### Step 5: webhooks (Jesse, before step 7)

- **Stripe:** in Workbench → Webhooks, find the live endpoint. Record four facts, none of them secret:
  - its URL (apex or www; both will work);
  - its **API version**;
  - whether it is **enabled**;
  - the date of the **earliest failed delivery**.
  
  Do not create a second endpoint. Two endpoints would deliver every event twice.
- **Stream:** the account has a single webhook URL. The domain does not change, so the URL is not repointed. Only the secret has to match.

### Step 8: public smoke checks (sprite, no credentials)

- `GET https://evolutioncombatives.com/api/health` and `https://www.evolutioncombatives.com/api/health` return 200 JSON from `server: cloudflare`, and neither redirects to the other.
- `GET /api/webhooks/stripe` and `GET /api/webhooks/cloudflare` return 200 JSON.
- `POST https://www.evolutioncombatives.com/api/mobile/video/signed-url` with no token returns 401 JSON. That proves the mobile route is live on www.
- `/login` renders, and `/dashboard` redirects to `/login` when signed out.

### Step 9: signed-in checks (Jesse)

1. **Admin:** log in on both apex and www, then open the dashboard, the videos page and a video preview.
2. **Video playback:** in the production mobile app, a paid account plays a paid video and a free account is denied. If playback fails, see risk 4 below.
3. **Checkout:** start checkout for each tier in the mobile app. The Stripe page must show the right product. No purchase is needed.
4. **Stripe webhooks:**
   - Watch the endpoint's deliveries turn 2xx while Stripe retries the backlog.
   - Resend from the dashboard any failed event that is older than the retry window.
   - Confirm the endpoint is still enabled.
   - Check that the Worker logs show no `signature verification failed`.
5. **Stream webhooks:** upload a short clip in the admin and watch `processing_status` reach `ready`. Then run "sync all" on the processing page to recover notifications missed during the outage.
6. **Reconcile:** in Stripe live mode, list all active and trialing subscriptions (paginate through the full result), map each subscription ID and customer to its member and tier, and compare them with all `platform = 'stripe'` rows and the members' `profiles.subscription_tier` values. Flag missing rows, wrong subscription IDs, stale status or tier, database active rows without a matching active Stripe subscription, and profile mismatches; replay or repair each mismatch and compare again before declaring reconciliation complete. The read-only query in `docs/GO-LIVE.md` §8 finds only one subset of mismatches and cannot detect a missing subscription row.

### Step 10: clean-up and Vercel shut-off

- Jesse:
  - In the GitHub `Production` environment, replace the temporary deploy token with a per-Worker token, then delete the temporary token in Cloudflare.
  - In Vercel, remove the domains from the project and delete the project.
  - In Cloudflare DNS, delete `testing.evolutioncombatives.com` and any `_vercel` TXT records, or point `testing` at the staging Worker later.
  - Close the Vercel billing.
- Navi sprite: run the follow-up PRs listed under risks.

## Smallest first release

PR #38 plus the five fixes in step 2, merged once and approved once, with the seven Worker secrets set and the two Vercel DNS records deleted. That release brings back:

- the admin dashboard on apex and www;
- the mobile API on www (signed video URLs and checkout);
- the Stripe and Stream webhooks.

Everything else waits until after launch: staging and preview secrets, the separate non-production Stream account, `script-src` tightening and the mobile follow-ups.

## Risks

1. **Stripe webhook backlog (time-critical).** In live mode Stripe retries a failed delivery for up to three days ([Stripe docs](https://docs.stripe.com/webhooks/process-undelivered-events)). Events that first failed more than three days before cutover are no longer retried, so they must be resent by hand (step 9.4). An endpoint that keeps failing can also be disabled ([Stripe support](https://support.stripe.com/questions/why-is-stripe-trying-to-reach-my-webhook-endpoints)). The outage start date is unmeasured: the earliest failure observed was on 2026-10-12. If that is the start, the oldest events stop retrying around 2026-10-15.
2. **Stripe payload shape.** API version `2025-03-31.basil` and later removed the subscription-level `current_period_start` and `current_period_end` ([Stripe changelog](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end)) and moved `invoice.subscription` under `parent` ([Stripe changelog](https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects)). If the endpoint is on Basil or later, the current handler throws on every subscription create and update. Fix 2 removes that dependency. The endpoint's API version is unknown until Jesse reads it (step 5).
3. **Replays and re-subscribers.** A plain `insert` hits the unique keys, and delayed subscription or invoice events can replace a newer entitlement. Fix 2 guards every subscription and profile write; step 9.6 checks for missed or stale rows after replay.
4. **Mobile video ID mismatch (unconfirmed).**
   - The mobile `useSignedVideoUrl` passes `cloudflare_video_id`, which is what the Worker expects (a 32-character hex ID).
   - Before calling the API, though, `getSignedVideoUrl` queries `videos.id = <that id>`. `videos.id` is a `uuid`, so that query errors.
   - The other caller (prefetch) passes the database UUID, and the Worker rejects that with a 400.
   - This is in the mobile app and does not come from the migration. The device test in step 9.2 is the proof. If playback fails there, the fix belongs in `evolution-combatives-mobile`.
5. **Entitlement behaviour change.** On Vercel, the mobile signed-URL route trusted the tier the client sent. PR #38 reads the tier from the `subscriptions` table (status `active` or `trialing`). Members who have a tier only in `profiles.subscription_tier` will lose paid videos, for example comped gym members. Their count is unmeasured. A member with both an active Stripe row and an active RevenueCat row gets `none`, because `maybeSingle` fails on two rows.
6. **www redirect.** Never add a www→apex redirect rule. The mobile app POSTs to www, and Stripe treats a redirect as a failed delivery.
7. **Custom-domain attach.** Cloudflare cannot create a custom domain on a hostname that has a CNAME ([Cloudflare docs](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)). Step 6 has to come before the deploy. The deploy also fails without the zone-scoped token from step 3.
8. **Same name, different tokens.** `CLOUDFLARE_API_TOKEN` is both the GitHub deploy token and the Worker's Stream token. Putting the wrong one in either place breaks the deploy or video playback.
9. **Rollback.** Vercel is disabled, so there is nothing to fall back to. The rollback is `wrangler rollback` to an earlier Worker version, or a revert PR. Any revert deploy still waits for the Production reviewer.
10. **Every push to `main` deploys.** The Production reviewer gate is the only brake, and it is confirmed in place.
11. **Missing route.** `/api/mobile/subscriptions/portal`, which the mobile app calls, exists neither on `main` nor in PR #38. The "manage subscription" action returns 404. This predates the migration, does not block launch, and becomes a follow-up PR.
12. **Security audit.** The PR #38 audit results are not in the repo. The sprite review in step 1 covers the launch paths. Any part of the audit Jesse has not shared is recorded as not reviewed.
