# Evolution Combatives Admin - Cloudflare Workers Go-Live Checklist

This checklist documents all steps required to deploy the Evolution Combatives admin dashboard from Vercel to Cloudflare Workers.

## Environments

| Environment | Worker Name | Supabase Project | Stripe Mode | Purpose |
|-------------|-------------|------------------|-------------|---------|
| **Production** | `evolution-combatives-admin` | `bxpxpkiubjbcmgsnfpvp` (live, shared with mobile app) | Live | Production traffic on `evolutioncombatives.com` |
| **Staging** | `evolution-combatives-admin-staging` | `hknjeztslvbenmlaqfqa` (non-production) | Test | Manual testing, demo |
| **PR Preview** | `evolution-combatives-admin-preview` | `hknjeztslvbenmlaqfqa` (non-production) | Test | Per-PR preview versions |

**Important**: Staging and PR previews never touch production data. They use a completely separate Supabase project with Stripe test-mode keys.

---

## Production Domain (Confirmed)

- **Apex**: `evolutioncombatives.com`
- **WWW**: `www.evolutioncombatives.com`
- **Public access**: The production domain is the customer-facing site and is publicly accessible. Cloudflare Access is not applied to production.
- Custom domains are attached in a separate cutover change after the first production deploy (see Cutover section below)

---

## Pre-Deployment Prerequisites

### 0. Update Production Stripe Values in wrangler.jsonc (LAUNCH BLOCKER)

**⚠️ REQUIRED BEFORE FIRST PRODUCTION DEPLOY**: The production environment in `wrangler.jsonc` has placeholder values for Stripe:

```jsonc
// Lines 78-81 in wrangler.jsonc - currently set to "update"
"STRIPE_PUBLISHABLE_KEY": "update",
"STRIPE_BEGINNER_PRICE_ID": "update",
"STRIPE_INTERMEDIATE_PRICE_ID": "update",
"STRIPE_ADVANCED_PRICE_ID": "update"
```

Replace these with live-mode values from Stripe Dashboard → Products → Pricing before deploying to production:
- `STRIPE_PUBLISHABLE_KEY` → `pk_live_...` from Stripe → Developers → API keys
- `STRIPE_BEGINNER_PRICE_ID` → Price ID for $9 Beginner tier
- `STRIPE_INTERMEDIATE_PRICE_ID` → Price ID for $19 Intermediate tier
- `STRIPE_ADVANCED_PRICE_ID` → Price ID for $49 Advanced tier

Staging and preview environments already have test-mode values configured.

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

**Note**: These tokens have Workers > Specified Workers > Editor scope and cannot attach custom domains. Custom domain attachment at cutover requires a separate token (see Cutover section). If a deploy fails on an account-level lookup, add **Workers** → **All Workers** → **Metadata Read-Only** to the token rather than widening Editor scope.

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

### Separate Cloudflare Account for Non-Production Stream (Required)
- [ ] Staging and preview use Cloudflare Stream in a **separate Cloudflare account** (a different account ID) from production. A second Stream library, API token, or signing key inside the production Cloudflare account does not satisfy this item.
  - Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_CUSTOMER_SUBDOMAIN` in `wrangler.jsonc` `env.staging` and `env.preview` to the non-production account's values.
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

## 6. First Production Deploy (Worker Only)

The first approved production deploy creates or updates the Worker without attaching custom domains:

1. Merge the PR (squash merge)
2. The deploy workflow runs and requires Production environment reviewer approval
3. After approval, the Worker is deployed to `evolution-combatives-admin`
4. The Worker has no routes and no `workers.dev` URL (`workers_dev: false`)
5. Verify the Worker exists in Cloudflare Dashboard → Workers & Pages

At this point, production traffic continues to flow to the existing deployment (Vercel). The Worker is deployed but not receiving traffic.

---

## 7. Domain Cutover (Separate Change)

Cutover is a separate small PR that attaches custom domains to the production Worker.

### Cutover PR Contents

Add this to `wrangler.jsonc` top-level (not inside an env block):

```jsonc
"routes": [
    { "pattern": "evolutioncombatives.com", "custom_domain": true },
    { "pattern": "www.evolutioncombatives.com", "custom_domain": true }
]
```

### Before Approving the Cutover Deploy

1. **Check zone DNS records** (read-only): In Cloudflare Dashboard → DNS, verify the apex and www records. Custom domain attachment may modify them.
2. **Verify production Worker secrets are set**: All secrets from Section 3 must be configured on the production Worker.
3. **Confirm mobile playback against staging**: Complete the staging mobile playback test from Section 4 before cutover. The production Worker has no routes, no `workers.dev` address, and no preview URLs before cutover.
4. **Plan post-cutover verification**: After cutover, run the Post-Cutover Smoke Test at the end of this document.

### Cutover Token Requirements

The cutover deploy requires a token that can both deploy the Worker and attach custom domains. The per-Worker token from Section 1 cannot attach custom domains. For cutover:

1. Create a temporary account-owned token via Manage Account → Account API Tokens with:
   - **Workers** → **All Workers** → **Editor**
   - **Zone** → **Workers Routes** → **Edit** limited to the `evolutioncombatives.com` zone
2. Store this token as `CLOUDFLARE_API_TOKEN` in the **Production** GitHub environment for the cutover deploy only
3. After cutover succeeds, restore the per-Worker production token from Section 1 in the Production environment
4. Delete the temporary cutover token from the Cloudflare account

### Current DNS (Vercel)
The domain `evolutioncombatives.com` currently points to Vercel.

### After Cutover

**Cloudflare-managed DNS:**
If the domain is on Cloudflare DNS, custom domain attachment handles the DNS automatically.

**External DNS:**
If DNS is managed elsewhere:
1. Create CNAME records:
   - `evolutioncombatives.com` → `evolution-combatives-admin.jesse-6b1.workers.dev`
   - `www.evolutioncombatives.com` → `evolution-combatives-admin.jesse-6b1.workers.dev`
2. Enable Cloudflare proxy (orange cloud) if using Cloudflare DNS

### Verification
After DNS propagation:
```bash
curl -I https://evolutioncombatives.com/api/health
# Should show Server: cloudflare
```

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

### Important: Events During Vercel Outage
If Vercel was returning 402 DEPLOYMENT_DISABLED, Stripe webhook deliveries may have failed.
1. Check Stripe Dashboard → Webhooks → Recent deliveries for failures
2. For failed subscription events, manually reconcile subscriptions table:
   ```sql
   -- Check for subscriptions with mismatched status
   SELECT s.*, p.subscription_tier
   FROM subscriptions s
   JOIN profiles p ON s.user_id = p.id
   WHERE s.status = 'active' AND p.subscription_tier IS NULL;
   ```
3. Consider triggering Stripe webhook replay for critical failed events

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

### Option 2: DNS Rollback to Vercel
If critical issues arise:
1. Point DNS back to Vercel (if Vercel deployment is re-enabled)
2. Or restore from a prior Worker version

### Option 3: Quick Fix Deploy
```bash
git revert HEAD
pnpm deploy:production
```

---

## Post-Cutover Smoke Test

Run these checks after cutover:

1. **Login and Dashboard**
   - [ ] Navigate to `https://evolutioncombatives.com` and verify login works
   - [ ] Dashboard loads after authentication

2. **API Health**
   - [ ] `/api/health` returns 200
   - [ ] `/api/csrf-token` returns token

3. **Mobile API**
   - [ ] `/api/mobile/video/signed-url` accepts Bearer token

4. **Webhook Verification**
   - [ ] Upload a test video to Cloudflare Stream
   - [ ] Verify webhook is received (check Worker logs for 200 response)
   - [ ] Verify video status is updated in database

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
| DNS cutover | 5-15 minutes (propagation) |
| Smoke testing | 15 minutes |
| **Total** | ~1.5 hours |

Note: Cloudflare Access on staging/preview is already configured (see Section 10).
