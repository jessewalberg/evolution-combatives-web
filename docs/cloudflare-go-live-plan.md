# Cloudflare Workers Go-Live Cutover Plan

Written 2026-10-12. Updated 2026-10-15 with PR #41 merged state.

**Current state**: PR #41 (Workers migration) is merged into `main`. The site runs on Cloudflare Workers with:
- Custom domains: `evolutioncombatives.com` and `www.evolutioncombatives.com`
- `workers_dev: false`, `preview_urls: false` in production
- Idempotent Stripe webhook handling with event ID deduplication and order-independent reconciliation
- Versioned entitlement writes that re-read from Stripe API

Jesse's decisions this plan carries:

- [J 2026-10-12] "No it should not run we are getting rid of vercel this should be on cloudflare now." Vercel will not be fixed. The site moves to Cloudflare Workers.
- [J 2026-10-09] No unit tests. Verification uses build, typecheck, lint, Playwright E2E, real-surface checks and independent review.

## Pre-Cutover Checklist

### 1. Verify Database Migrations Applied (CRITICAL)

Before approving the production deploy, verify that all required migrations have been applied to the production Supabase project (`bxpxpkiubjbcmgsnfpvp`).

**Required migrations** (in order):
- `20260808000003_fix_stripe_subscription_columns.sql` — Stripe columns and unique indexes
- `20261012000000_reconcile_stripe_entitlement.sql` — Atomic entitlement RPC
- `20261012100000_protect_manual_tier.sql` — RLS for manual_tier
- `20261012110000_record_stripe_customer.sql` — Stripe customer recording RPC

**Verification query** (run against production with read-only access):

```sql
-- Check that the reconcile_stripe_entitlement function exists
SELECT proname, prosrc IS NOT NULL as has_body
FROM pg_proc
WHERE proname = 'reconcile_stripe_entitlement';

-- Check that required columns exist on subscriptions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name IN (
    'stripe_subscription_id',
    'stripe_customer_id',
    'stripe_event_id',
    'stripe_event_created',
    'stripe_subscription_created'
  );

-- Check that stripe_customers table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'stripe_customers'
) as stripe_customers_exists;

-- Check unique constraints
SELECT indexname
FROM pg_indexes
WHERE tablename = 'subscriptions'
  AND indexname IN ('subscriptions_stripe_subscription_id_key', 'subscriptions_user_id_platform_key');
```

**Expected results**:
- `reconcile_stripe_entitlement` function exists with body
- All five `stripe_*` columns exist on subscriptions
- `stripe_customers` table exists
- Both unique indexes exist

**Do not approve the production deploy if any of these are missing.**

### 2. Stripe Webhook Endpoint Status

Before cutover, verify the existing Stripe webhook endpoint status:

1. In **Stripe Dashboard → Developers → Webhooks**, locate the endpoint at `https://evolutioncombatives.com/api/webhooks/stripe` or `https://www.evolutioncombatives.com/api/webhooks/stripe`
2. Record:
   - **URL**: apex or www (both will work post-cutover)
   - **API version**: Check if it's `2025-03-31.basil` or later (period fields moved)
   - **Enabled state**: Is it currently enabled or disabled?
   - **Earliest failed delivery**: When did failures start?

**If the endpoint was disabled**, it must be re-enabled after the Worker is verified serving both domains (step 5 below). Do not create a second endpoint.

### 3. DNS Records

Before the deploy that attaches custom domains:
- Delete the apex `A` record pointing at Vercel
- Delete the `www` CNAME pointing at Vercel

Cloudflare cannot create a custom domain on a hostname that still has a CNAME. DNS is already on Cloudflare (`anita`/`matias.ns.cloudflare.com`); custom domain attachment writes the replacement records automatically.

### 4. Stripe Price IDs

Replace the three `PLACEHOLDER_STRIPE_*` values in `wrangler.jsonc` with live-mode price IDs:
- `STRIPE_BEGINNER_PRICE_ID`
- `STRIPE_INTERMEDIATE_PRICE_ID`
- `STRIPE_ADVANCED_PRICE_ID`

These are config vars, not secrets. The Worker returns HTTP 500 while any remains a placeholder.

### 5. Worker Secrets

Set these on `evolution-combatives-admin` with `wrangler secret put <NAME>`:

| Secret | Source |
|--------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase production project → API |
| `STRIPE_SECRET_KEY` | Stripe live mode → API keys |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the existing live endpoint |
| `CLOUDFLARE_API_TOKEN` | Stream token with Stream: Edit (not the deploy token) |
| `CLOUDFLARE_STREAM_SIGNING_KEY_ID` | Stream → signing keys |
| `CLOUDFLARE_STREAM_SIGNING_KEY` | Stream → signing keys (PEM format) |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | `GET /accounts/{id}/stream/webhook` |

## Cutover Steps

### Step 1: Final Pre-Deploy Checks

- [ ] Run migration verification query (section 1) — all checks pass
- [ ] Stripe webhook endpoint status recorded (section 2)
- [ ] Vercel DNS records deleted (section 3)
- [ ] Price IDs replaced in `wrangler.jsonc`
- [ ] All Worker secrets set

### Step 2: Merge and Deploy

1. Squash-merge the release PR into `main`
2. Wait for CI to pass (typecheck, lint, build, Playwright E2E)
3. Approve the `Deploy` run in the Production environment

### Step 3: Public Smoke Checks

- [ ] `GET https://evolutioncombatives.com/api/health` returns 200 JSON with `server: cloudflare`
- [ ] `GET https://www.evolutioncombatives.com/api/health` returns 200 JSON (no redirect)
- [ ] `GET /api/webhooks/stripe` returns 200 JSON
- [ ] `GET /api/webhooks/cloudflare` returns 200 JSON
- [ ] `POST https://www.evolutioncombatives.com/api/mobile/video/signed-url` with no token returns 401 JSON

### Step 4: Re-enable Stripe Webhook (if disabled)

If the Stripe endpoint was disabled during the outage:

1. **Verify Worker is healthy**: Both `/api/health` endpoints return 200
2. **Re-enable the endpoint** in Stripe Dashboard → Webhooks
3. **Send a test delivery** to confirm 2xx response
4. **Watch the backlog replay**: Deliveries should turn 2xx as Stripe retries
5. **Resend old failures**: Any event older than the retry window (3 days) must be manually resent from the Stripe dashboard
6. **Check Worker logs**: Confirm no `signature verification failed` errors

**Important**: The webhook handler is idempotent by event ID. Duplicate deliveries are safely ignored. Out-of-order events are handled correctly because the handler re-reads from the Stripe API.

### Step 5: Reconciliation for Missing Subscription Rows

After webhook replay completes, paid members who had no Stripe webhook delivery during the outage may be missing subscription rows. Run the reconciliation:

**Identify missing rows** (read-only Stripe API + database comparison):

```bash
# In Stripe live mode, list all active and trialing subscriptions
# For each subscription with metadata.userId:
# 1. Check if a subscription row exists for that user_id with platform='stripe'
# 2. Flag members with active Stripe subscriptions but no database row
```

**Reconciliation via webhook replay**:

For each flagged subscription:
1. In Stripe Dashboard → Webhooks → Recent events
2. Find the most recent `customer.subscription.updated` event for that subscription
3. Click "Resend" to trigger the webhook handler
4. The handler will create the missing subscription row from the current Stripe state

**Verification**:

```sql
-- Find active Stripe subscriptions without matching database rows
-- Run this after reconciliation to confirm no gaps remain
SELECT p.id, p.email, p.subscription_tier
FROM profiles p
WHERE p.subscription_tier != 'none'
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = p.id
      AND s.platform = 'stripe'
      AND s.status IN ('active', 'trialing')
  );
```

If any rows remain, investigate manually — the member may have:
- A `manual_tier` grant (comped membership)
- A RevenueCat subscription instead of Stripe
- An orphaned profile tier from before the migration

### Step 6: Signed-In Checks (Jesse)

1. **Admin**: Log in on both apex and www, open dashboard and videos
2. **Video playback**: Paid account plays paid video, free account is denied
3. **Checkout**: Start checkout for each tier, verify correct Stripe product shows
4. **Stream webhooks**: Upload a clip, watch `processing_status` reach `ready`

### Step 7: Clean-up (48 hours after Step 6)

- Replace temporary deploy token with per-Worker token in GitHub Production environment
- Delete temporary token in Cloudflare
- Remove domains from Vercel project
- Delete `testing.evolutioncombatives.com` CNAME and `_vercel` TXT records
- Close Vercel billing

## Stripe Webhook Handling Details

The webhook handler (`src/server/webhooks/stripe.ts` + `stripe-reconcile.ts`) provides:

### Idempotency by Event ID

Each event's `id` is stored in `subscriptions.stripe_event_id`. Duplicate deliveries return `duplicate` without any database changes.

### Order-Independent Processing

The handler does not use event timestamps to decide what to write. Instead:
1. Extract the subscription ID from the event
2. Re-read the subscription from Stripe API (`subscriptions.retrieve`)
3. List all subscriptions for recorded customers
4. Select the highest-tier active/trialing subscription
5. Write that current state in one atomic transaction

This means a delayed `subscription.created` event arriving after a `subscription.updated` event is handled correctly — both will write the current Stripe state.

### Versioned Writes

The `profiles.stripe_reconcile_version` column provides optimistic locking. Concurrent webhook deliveries for the same member are serialized via the `reconcile_stripe_entitlement` RPC.

### API Version Compatibility

The handler reads period fields from `items.data[0].current_period_*` when top-level fields are missing (API version `2025-03-31.basil` and later). Invoice subscription is read from `parent.subscription_details.subscription` when `invoice.subscription` is missing.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stripe webhook backlog | Handler is idempotent; replay safe. Resend events older than 3 days manually. |
| API version changes | Handler reads from both old and new field locations. |
| Missing subscription rows | Reconciliation via webhook resend creates rows from current Stripe state. |
| Concurrent webhooks | Versioned writes with optimistic locking prevent stale writes. |
| www redirect | Never add www→apex redirect; mobile POSTs to www. |
| Custom domain attach | Delete Vercel CNAME before deploy. |

## wrangler.jsonc Configuration

Production configuration (already in `wrangler.jsonc`):

```jsonc
{
    "name": "evolution-combatives-admin",
    "workers_dev": false,
    "routes": [
        { "pattern": "evolutioncombatives.com", "custom_domain": true },
        { "pattern": "www.evolutioncombatives.com", "custom_domain": true }
    ],
    "preview_urls": false
}
```

Staging and preview have `routes: []` and do not inherit production routes.
