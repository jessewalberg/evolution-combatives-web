# Evolution Combatives Admin - Cloudflare Workers Go-Live Checklist

This checklist documents all steps required to deploy the Evolution Combatives admin dashboard from Vercel to Cloudflare Workers.

## Environments

| Environment | Worker Name | Supabase Project | Stripe Mode | Purpose |
|-------------|-------------|------------------|-------------|---------|
| **Production** | `evolution-combatives-admin` | `bxpxpkiubjbcmgsnfpvp` (live, shared with mobile app) | Live | Production traffic on apex and www |
| **Staging** | `evolution-combatives-admin-staging` | `hknjeztslvbenmlaqfqa` (non-production) | Test | Manual testing, demo |
| **PR Preview** | `evolution-combatives-admin-preview` | `hknjeztslvbenmlaqfqa` (non-production) | Test | Per-PR preview versions |

**Important**: Staging and PR previews never touch production data. They use a completely separate Supabase project with Stripe test-mode keys.

---

## Production Domain (Confirmed)

- **Apex**: `evolutioncombatives.com`
- **WWW**: `www.evolutioncombatives.com`
- **Public access**: The production domain is the customer-facing site and is publicly accessible. Cloudflare Access is not applied to production.
- This release attaches both hostnames as Worker custom domains. `www` is served directly. Do not add a www→apex redirect: the mobile app POSTs to `https://www.evolutioncombatives.com/api/mobile/*`, and Stripe treats a redirect as a failed delivery.

---

## Pre-Deployment Prerequisites

### 0. Update Production Stripe Values in wrangler.jsonc (LAUNCH BLOCKER)

**⚠️ REQUIRED BEFORE FIRST PRODUCTION DEPLOY**: The production environment in `wrangler.jsonc` has placeholder values for Stripe:

```jsonc
"STRIPE_BEGINNER_PRICE_ID": "PLACEHOLDER_STRIPE_BEGINNER_PRICE_ID",
"STRIPE_INTERMEDIATE_PRICE_ID": "PLACEHOLDER_STRIPE_INTERMEDIATE_PRICE_ID",
"STRIPE_ADVANCED_PRICE_ID": "PLACEHOLDER_STRIPE_ADVANCED_PRICE_ID"
```

Replace those three placeholders in `wrangler.jsonc` with the live-mode price ids before the production deploy. Requests to `evolutioncombatives.com` and `www.evolutioncombatives.com`, including `/api/health`, return HTTP 500 while any of them is unset or still a `PLACEHOLDER_` value. They are config vars, not secrets.

`STRIPE_PUBLISHABLE_KEY` is still `"update"` and is unused. Web checkout was removed. It is not a launch blocker.

Staging and preview environments already have test-mode price ids configured.

---

### 1. Cloudflare Account Configuration

#### Required: Two Account-Owned API Tokens (Per-Worker)
Create two account-owned API tokens, each limited to one Worker:

**Preview Token** (for `evolution-combatives-admin-preview`):
1. Cloudflare Dashboard → Manage Account → Account API Tokens → Create Token
2. Use **Custom token** template
3. Permissions: **Workers** with scope **Specified Workers** limited to `evolution-combatives-admin-preview`, role **Editor**
4. Store as GitHub Environment secret `CLOUDFLARE_API_TOKEN` in the **Preview** environment
5. Store `CLOUDFLARE_ACCOUNT_ID` (`6b13f76a2d42fd29437154c35fa8a0c9`) in the **Preview** environment

**Production Token** (for `evolution-combatives-admin`):
1. Create a separate account-owned token following the same steps
2. Scope **Specified Workers** limited to `evolution-combatives-admin`, role **Editor**
3. Store as GitHub Environment secret `CLOUDFLARE_API_TOKEN` in the **Production** environment
4. Store `CLOUDFLARE_ACCOUNT_ID` in the **Production** environment

**Note**: These tokens have Workers > Specified Workers > Editor scope and cannot attach custom domains. This release's production deploy attaches the apex and www custom domains, so that deploy needs the temporary token in section 6. If a deploy fails on an account-level lookup, add **Workers** → **All Workers** → **Metadata Read-Only** to the token rather than widening Editor scope.

#### Account ID
- **Value**: `6b13f76a2d42fd29437154c35fa8a0c9` (already configured)
- **Where it's used**: `wrangler.jsonc` top-level `account_id`
- Store as `CLOUDFLARE_ACCOUNT_ID` in both **Preview** and **Production** GitHub environments

#### Worker Names (already configured)
- **Production**: `evolution-combatives-admin`
- **Staging**: `evolution-combatives-admin-staging`
- **Preview**: `evolution-combatives-admin-preview`

---

## 2. GitHub Secrets

### GitHub Environments
Create two GitHub Environments: `production` and `preview`

### Required Reviewers (Production Protection)
- [ ] **Enable required reviewers** for the `production` GitHub environment:
  1. Go to repo **Settings → Environments → production**
  2. Check **Required reviewers**
  3. Add designated reviewer(s) who must approve production deployments
  4. This ensures production deploys require explicit human approval before running

### Production Environment Secrets
| Secret Name | Where to Get Value | Purpose |
|-------------|-------------------|---------|
| `CLOUDFLARE_API_TOKEN` | Account-owned token for `evolution-combatives-admin` (see Section 1) | Deploy production Worker |
| `CLOUDFLARE_ACCOUNT_ID` | `6b13f76a2d42fd29437154c35fa8a0c9` | Worker deployment |

### Preview Environment Secrets
The Preview environment is used by both the preview deploy workflow and E2E tests.

**Deploy secrets:**
| Secret Name | Where to Get Value | Purpose |
|-------------|-------------------|---------|
| `CLOUDFLARE_API_TOKEN` | Account-owned token for `evolution-combatives-admin-preview` (see Section 1) | Deploy preview Worker |
| `CLOUDFLARE_ACCOUNT_ID` | `6b13f76a2d42fd29437154c35fa8a0c9` | Worker deployment |

**E2E test secrets (test-mode values only):**
| Secret Name | Where to Get Value | Purpose |
|-------------|-------------------|---------|
| `VITE_SUPABASE_URL` | Non-production Supabase project URL | E2E test database |
| `VITE_SUPABASE_ANON_KEY` | Non-production Supabase anon key | E2E test auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Non-production Supabase service role key | E2E test cleanup |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key | E2E test payments |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test-mode publishable key | E2E test payments |
| `STRIPE_BEGINNER_PRICE_ID` | Stripe test-mode price ID | E2E test tier |
| `STRIPE_INTERMEDIATE_PRICE_ID` | Stripe test-mode price ID | E2E test tier |
| `STRIPE_ADVANCED_PRICE_ID` | Stripe test-mode price ID | E2E test tier |
| `CLOUDFLARE_CUSTOMER_SUBDOMAIN` | Non-production Stream subdomain | E2E test video |
| `VITE_MOBILE_APP_SCHEME` | `evolutioncombatives` | E2E test deep links |
| `VITE_POSTHOG_KEY` | PostHog project key | E2E test analytics |
| `VITE_POSTHOG_HOST` | PostHog host URL | E2E test analytics |
| `VITE_APP_URL` | Preview Worker URL | E2E test base URL |
| `VITE_ADMIN_URL` | Preview Worker URL | E2E test admin URL |
| `E2E_ADMIN_EMAIL` | E2E test admin user email | E2E test login |
| `E2E_ADMIN_PASSWORD` | E2E test admin user password | E2E test login |
| `CF_ACCESS_CLIENT_ID` | Zero Trust → Service Tokens | E2E access to Access-protected URLs |
| `CF_ACCESS_CLIENT_SECRET` | Zero Trust → Service Tokens | E2E access to Access-protected URLs |

**Note**: After confirming one PR's preview upload and E2E run succeeds with the Preview environment secrets, delete these repo-level secrets:
- `CLOUDFLARE_API_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLOUDFLARE_STREAM_SIGNING_KEY`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`
- `CLOUDFLARE_STREAM_WEBHOOK_SECRET`

---

## 3. Worker Secrets (via wrangler secret)

These secrets must be set on each Worker environment. Run these commands:

### Production Secrets
```bash
# Supabase (get from Supabase Dashboard → Settings → API)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Stripe (get from Stripe Dashboard → Developers → API keys)
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET  # After creating webhook endpoint

# Cloudflare Stream (get from Stream → Settings → API)
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY      # REQUIRED - see below
wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID   # REQUIRED - see below
wrangler secret put CLOUDFLARE_STREAM_WEBHOOK_SECRET   # After creating webhook endpoint
```

### Staging Secrets
```bash
wrangler secret put --env staging SUPABASE_SERVICE_ROLE_KEY
wrangler secret put --env staging STRIPE_SECRET_KEY
wrangler secret put --env staging STRIPE_WEBHOOK_SECRET
wrangler secret put --env staging CLOUDFLARE_API_TOKEN
wrangler secret put --env staging CLOUDFLARE_STREAM_SIGNING_KEY
wrangler secret put --env staging CLOUDFLARE_STREAM_SIGNING_KEY_ID
wrangler secret put --env staging CLOUDFLARE_STREAM_WEBHOOK_SECRET
```

---

## 4. Cloudflare Stream Signed URLs (Required)

Signed URL generation fails closed if Stream signing keys are not configured.

- [ ] Before cutover, inventory every production Stream video and set `requireSignedURLs` to `true` for each one. Verify that an unsigned playback URL is denied for every video; changing the Worker alone does not make previously public videos private.

### Separate Cloudflare Account for Non-Production Stream (Required)
- [ ] Staging and preview use Cloudflare Stream in a **separate Cloudflare account** (a different account ID) from production. A second Stream library, API token, or signing key inside the production Cloudflare account does not satisfy this item.
  - Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_CUSTOMER_SUBDOMAIN` in `wrangler.jsonc` `env.staging` and `env.preview` to the non-production account's values.
  - The checked-in values are placeholders. Stream operations fail until both are replaced with that separate account's values.
  - Create the staging/preview `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_KEY`, and `CLOUDFLARE_STREAM_WEBHOOK_SECRET` in the non-production account and set them with `wrangler secret put --env staging` / `--env preview`.
  - Upload test videos to the non-production account only.

### Pre-Cutover Steps

1. **Create Signing Keys** in Cloudflare Dashboard:
   - Go to Stream → Settings → API
   - Create a new signing key
   - Copy the Key ID and Private Key

2. **Set the Worker Secrets**:
   ```bash
   wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID
   # Paste the Key ID
   
   wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY
   # Paste the Private Key (PEM format)
   ```

3. - [ ] **Mobile playback test against staging (must pass before DNS cutover).** Using a mobile build pointed at the staging Worker, sign in as a paid test user and play a paid video (a signed URL is issued and plays). Then confirm an unpaid user is denied. The mobile app and the Workers API must agree on which video identifier is sent.

The signing key id and PEM are a gate only. `generateSignedUrl` returns 503 when either is missing. The Worker does not sign the playback token with that PEM. It calls Stream's `/token` API with `CLOUDFLARE_API_TOKEN`. Paid playback needs both the gate secrets and that API token.

---

## 5. Supabase Auth Configuration

Update redirect URL settings in Supabase Dashboard → Authentication → URL Configuration for each project.

### Production Project (`bxpxpkiubjbcmgsnfpvp`)

**Site URL**: `https://evolutioncombatives.com` (no change needed)

**Redirect URLs** — add these:
```
https://evolutioncombatives.com/**
https://www.evolutioncombatives.com/**
```

Note: The production `workers.dev` URL is not needed because production has `workers_dev: false` in wrangler.jsonc.

### Staging/Preview Project (`hknjeztslvbenmlaqfqa`)

**Site URL**: `https://evolution-combatives-admin-staging.jesse-6b1.workers.dev`

**Redirect URLs** — add these:
```
https://evolution-combatives-admin-staging.jesse-6b1.workers.dev/**
https://evolution-combatives-admin-preview.jesse-6b1.workers.dev/**
https://*-evolution-combatives-admin-preview.jesse-6b1.workers.dev/**
```

The wildcard with hyphen covers all PR preview version URLs (e.g., `<id>-evolution-combatives-admin-preview...`).

---

## 6. Production deploy (single release)

Vercel stays disabled. This release is the cutover: squash-merge once, approve the Production deploy once. The top-level `wrangler.jsonc` routes attach both hostnames:

```jsonc
"routes": [
    { "pattern": "evolutioncombatives.com", "custom_domain": true },
    { "pattern": "www.evolutioncombatives.com", "custom_domain": true }
]
```

Staging and preview set `routes: []` and do not inherit them. `www` is served directly. Do not add a redirect from www to the apex.

### Before approving the deploy

1. Replace the three `PLACEHOLDER_STRIPE_*` price ids in `wrangler.jsonc` (section 0).
2. Apply pending production Supabase migrations in order, including `20260808000003_fix_stripe_subscription_columns.sql`, `20261012000000_reconcile_stripe_entitlement.sql`, and `20261012100000_protect_manual_tier.sql`. Confirm `subscriptions.stripe_subscription_id` is unique, `(user_id, platform)` is unique, and members cannot update `profiles.manual_tier`. `deploy.yml` does not apply migrations. Do not approve the deploy while this schema is missing.
3. Set the Worker secrets in section 3.
4. Delete the apex `A` record and the `www` CNAME that point at Vercel, immediately before approving the deploy. Cloudflare cannot create a custom domain on a hostname that still has a CNAME. DNS is already on Cloudflare (`anita`/`matias.ns.cloudflare.com`); custom domain attachment writes the replacement records. Do not point the names at `workers.dev` by hand.
5. Put the temporary deploy token below in the Production GitHub environment.

Then merge and approve the deploy. After it succeeds, restore the per-Worker production token from section 1 and delete the temporary token.

### Deploy token

The per-Worker token from section 1 cannot attach custom domains. For this deploy, create a temporary account-owned token via Manage Account → Account API Tokens with:

- **Workers** → **All Workers** → **Editor**
- **Zone** → **Workers Routes** → **Edit** limited to the `evolutioncombatives.com` zone

Store it as `CLOUDFLARE_API_TOKEN` in the **Production** GitHub environment for this deploy only.

---

## 8. Stripe Webhook Configuration

### Check for Existing Endpoint (Recommended)

The domain `evolutioncombatives.com` is not changing, so a live-mode webhook endpoint may already exist from the Vercel deployment:

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Look for an existing endpoint at `https://evolutioncombatives.com/api/webhooks/stripe`
3. **If it exists**: Reuse it and its existing signing secret (set as `STRIPE_WEBHOOK_SECRET`)
4. **If it doesn't exist**: Create a new endpoint (see below)

**Do not create a duplicate endpoint** — this would cause double-delivery of webhook events.

### Create New Webhook Endpoint (Only If None Exists)
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://evolutioncombatives.com/api/webhooks/stripe`
3. Select the subscription and checkout events needed for the app
4. Copy the webhook signing secret → Set as `STRIPE_WEBHOOK_SECRET`

### API version and retries

Record the existing endpoint's URL (apex or www; both are served), its API version, whether it is enabled, and the date of the earliest failed delivery. Do not create a second endpoint.

API version `2025-03-31.basil` and later removed subscription-level `current_period_start` / `current_period_end` and moved `invoice.subscription` under `parent`. The handler reads period fields from the subscription item when the top-level fields are missing, and reads the invoice subscription from `parent.subscription_details.subscription`.

`POST /api/webhooks/stripe` is exempt from the per-IP API rate limit so a backlog replay is not answered 429. The Stream webhook and every other route stay limited.

If the endpoint was disabled, re-enable it after both hostnames return 200 from `/api/health`. Send one delivery, confirm a 2xx, then let Stripe retry the backlog. Resend any failed event older than the retry window from the dashboard.

The handler re-reads the event subscription and lists subscriptions for every customer recorded for the member in `stripe_customers` plus the event customer. Stripe search only discovers additional customers, and each of those is listed before it can affect the decision. It accepts a subscription with matching member metadata, or one with no member metadata whose customer is recorded only for that member; conflicting member metadata is never accepted. A customer can be recorded for multiple members, but that shared customer alone does not establish ownership of an untagged subscription. Email alone does not establish ownership.

The current item price determines the Stripe tier; unknown prices grant none. Among active or trialing subscriptions, the highest tier wins, with newer creation time and then subscription id breaking ties. If none is current, the newest subscription is persisted with no Stripe tier. A denial is written only when every search hit for the member was confirmed by list. If search returns no subscription for the member, or a hit the list did not confirm, the handler returns a retryable error and does not write the denial. A genuine cancellation still commits when its customers were listed and the search hits agree with that list. One database transaction locks the profile, checks its reconciliation version, upserts the single Stripe row, records customer ids, and sets `profiles.subscription_tier` to the higher of the Stripe tier and `profiles.manual_tier`. The webhook never changes `manual_tier`. Duplicate event ids are ignored; other events apply the freshly read Stripe snapshot regardless of event timestamp. Web and mobile signed video URLs use the same effective tier: the higher of `manual_tier` and active or trialing Stripe subscription tiers.

### Reconcile after replay

The read-only query that looks for active rows with a null profile tier does not find a paid member who has no subscription row. After deliveries are 2xx, in Stripe live mode list every active and trialing subscription (paginate the full result). Resolve ownership from `metadata.userId`, or from `stripe_customers` only when that metadata is empty and the customer has one recorded owner; flag missing or conflicting ownership. Map tiers from current item prices, then compare the selected subscription with each member's `platform = 'stripe'` row. Flag missing rows, wrong subscription ids, stale status or tier, and database rows that are active without a matching active Stripe subscription. Review `profiles.manual_tier` grants separately from the derived `profiles.subscription_tier`; the migration does not infer manual grants from old profile tiers. Replay or repair each mismatch and compare again before calling reconciliation done.

---

## 9. Cloudflare Stream Webhook Configuration

### Check for Existing Webhook (Recommended)

A Stream webhook endpoint may already exist from the Vercel deployment:

1. Go to **Cloudflare Dashboard → Stream → Notifications**
2. Look for an existing webhook at `https://evolutioncombatives.com/api/webhooks/cloudflare`
3. **If it exists**: Reuse it and retrieve its signing secret (set as `CLOUDFLARE_STREAM_WEBHOOK_SECRET`)
4. **If it doesn't exist**: Create a new webhook (see below)

**Do not create a duplicate webhook** — this would cause double-delivery of events.

### Create New Webhook (Only If None Exists)
1. Go to Cloudflare Dashboard → Stream → Notifications
2. Add notification webhook: `https://evolutioncombatives.com/api/webhooks/cloudflare`
3. Copy the signing secret → Set as `CLOUDFLARE_STREAM_WEBHOOK_SECRET`

### Before Pointing Webhook at the Worker

Confirm `CLOUDFLARE_STREAM_WEBHOOK_SECRET` matches the secret returned by the Stream webhook API (`GET/PUT /accounts/{account_id}/stream/webhook`), and that this release is deployed.

---

## 10. Cloudflare Access Protection (Staging/Preview Only)

Cloudflare Access applies only to staging and preview Workers. The production domain (`evolutioncombatives.com`) is public and is not behind Access.

Staging and preview Workers are protected by Cloudflare Access. This was configured via `cf` CLI on Oct 8, 2026.

### Current Configuration

**Zero Trust Team**: `teamworkformula.cloudflareaccess.com`

**Access Applications** (self-hosted):

| Application | Hostname | Purpose |
|-------------|----------|---------|
| Staging | `*evolution-combatives-admin-staging.jesse-6b1.workers.dev` | Staging Worker + all version URLs |
| Preview | `*evolution-combatives-admin-preview.jesse-6b1.workers.dev` | Preview Worker + all version/preview URLs |

**Allowed Users**:
- `jesseparrot@gmail.com`
- `jesse@jessewalberg.com`

**Service Token**:
- Name: `evolution-combatives-ci`
- Expires: 2027-10-08
- Policy: `non_identity` (both applications)
- Stored as **Preview** environment secrets: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` (see Section 2)

### Known Limitation (Accepted)

Stripe test-mode webhooks and Cloudflare Stream webhooks to staging and preview URLs are blocked by Access. There is no bypass configured — this is by design. Test webhooks locally or use the production endpoint.

### Adding a Teammate

1. Go to **Zero Trust → Access → Applications**
2. Select the staging or preview application
3. Edit the policy and add an **Include** rule:
   - **Emails** → Add the teammate's email address
4. Repeat for the other application

### Rotating the Service Token (Before Oct 2027)

1. Go to **Zero Trust → Access → Service Tokens**
2. Create a new service token (e.g., `evolution-combatives-ci-2027`)
3. Update GitHub repo secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` with new values
4. Update both Access application policies to include the new token
5. Test CI runs successfully
6. Delete the old service token

---

## 11. PostHog & Sentry Configuration

### PostHog
No changes required - already configured via `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` in `wrangler.jsonc`.

### Sentry (if used)
Update allowed domains if Sentry integration exists.

---

## Deployment Commands

### Deploy to Production
```bash
pnpm deploy:production
```

### Deploy to Staging
```bash
pnpm deploy:staging
```

### Verify Deployment
```bash
# Health check
curl https://evolutioncombatives.com/api/health

# Check security headers
curl -I https://evolutioncombatives.com/
```

---

## Rollback Procedure

### Option 1: Wrangler Rollback
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous deployment
wrangler rollback <deployment-id>
```

### Option 2: Revert deploy
Vercel is disabled, so there is no DNS fallback. `wrangler rollback` restores an earlier Worker version. A revert PR still waits for the Production reviewer.

### Option 3: Quick Fix Deploy
```bash
git revert HEAD
pnpm deploy:production
```

---

## Post-Cutover Smoke Test

Run these checks after the production deploy. Neither host should redirect to the other.

1. **API health**
   - [ ] `GET https://evolutioncombatives.com/api/health` and `GET https://www.evolutioncombatives.com/api/health` return 200 JSON with `status: healthy`
   - [ ] `GET /api/webhooks/stripe` and `GET /api/webhooks/cloudflare` return 200 JSON
   - [ ] `POST https://www.evolutioncombatives.com/api/mobile/video/signed-url` with no token returns 401 JSON

2. **Login and Dashboard**
   - [ ] Log in on both apex and www
   - [ ] Dashboard, videos, and a video preview load
   - [ ] `/dashboard` redirects to `/login` when signed out

3. **Mobile**
   - [ ] A paid account plays a paid video and a free account is denied
   - [ ] Checkout for each tier opens Stripe showing the right product. No purchase is required

4. **Webhooks**
   - [ ] Stripe deliveries return 2xx and Worker logs show no signature failure
   - [ ] Upload a short clip and watch `processing_status` reach `ready`
   - [ ] Run the subscription reconciliation in section 8

5. **Admin Functions**
   - [ ] Video upload works
   - [ ] User management works

---

## Contacts

- **Cloudflare Account Owner**: Jesse Walberg
- **Supabase Project (Production)**: `bxpxpkiubjbcmgsnfpvp`
- **Supabase Project (Staging/Preview)**: `hknjeztslvbenmlaqfqa`
- **Stripe Account**: Production keys in 1Password

---

## Timeline Reference

| Step | Estimated Time |
|------|----------------|
| Update production Stripe values in wrangler.jsonc | 5 minutes |
| Set Worker secrets | 10 minutes |
| Set GitHub secrets | 5 minutes |
| Configure Stream signing keys | 10 minutes |
| Update Supabase URLs | 5 minutes |
| Verify/create Stripe webhook | 5 minutes |
| Verify/create Stream webhook | 5 minutes |
| Production deploy | 5 minutes |
| Stream signed playback verification | 10 minutes |
| Delete the two Vercel DNS records, then approve the deploy | 10 minutes |
| Smoke testing | 15 minutes |
| **Total** | ~1.5 hours |

Note: Cloudflare Access on staging/preview is already configured (see Section 10).
