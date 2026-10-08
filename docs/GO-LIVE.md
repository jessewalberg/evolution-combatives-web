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
- Both are configured as custom domain routes in `wrangler.jsonc`

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

#### Required: Cloudflare API Token
Create an API token with the following scopes:
- **Account**: Workers Scripts (Edit)
- **Zone**: Workers Routes (Edit)

**Where to get it**: Cloudflare Dashboard → My Profile → API Tokens → Create Token

**Where to store it**:
- GitHub Environment secret: `CLOUDFLARE_API_TOKEN`
- For local deploys: `wrangler secret put CLOUDFLARE_API_TOKEN`

#### Account ID
- **Value**: `6b13f76a2d42fd29437154c35fa8a0c9` (already configured)
- **Where it's used**: `wrangler.jsonc` top-level `account_id`

#### Worker Names (already configured)
- **Production**: `evolution-combatives-admin`
- **Staging**: `evolution-combatives-admin-staging`
- **Preview**: `evolution-combatives-admin-preview`

---

## 2. GitHub Secrets

### Repository-Level Secrets (Already Configured)
| Secret Name | Where to Get Value | Purpose |
|-------------|-------------------|---------|
| `CF_ACCESS_CLIENT_ID` | Zero Trust → Service Tokens | CI access to Access-protected staging/preview URLs |
| `CF_ACCESS_CLIENT_SECRET` | Zero Trust → Service Tokens | CI access to Access-protected staging/preview URLs |

These are repo-level secrets (not environment secrets) because both CI jobs and local Playwright runs may need them.

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
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Tokens page | Deploy Workers |
| `CLOUDFLARE_ACCOUNT_ID` | `6b13f76a2d42fd29437154c35fa8a0c9` | Worker deployment |

### Preview Environment Secrets
| Secret Name | Where to Get Value | Purpose |
|-------------|-------------------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Tokens page | Deploy preview Workers |
| `CLOUDFLARE_ACCOUNT_ID` | `6b13f76a2d42fd29437154c35fa8a0c9` | Worker deployment |

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

### Separate Stream Accounts (Required)
- [ ] **Use separate Cloudflare Stream accounts** for staging/preview versus production:
  - Staging and preview Workers **must** use a non-production Stream account (separate account ID and API token)
  - This isolates test uploads and webhooks from production video library
  - Prevents accidental cross-environment video ID collisions and webhook delivery confusion
  - Update `CLOUDFLARE_ACCOUNT_ID` in `wrangler.jsonc` `env.staging` and `env.preview` blocks if needed
  - Each environment's Stream signing keys and webhook secrets belong to their respective accounts

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

## 6. Post-Deploy Verification (Before DNS Cutover)

After deploying to production but BEFORE updating DNS:

- [ ] Stream signing already enforced; confirm signed playback works on web and mobile after deploy.

---

## 7. DNS Cutover

### Current DNS (Vercel)
The domain `evolutioncombatives.com` currently points to Vercel.

### New DNS (Cloudflare Workers)

**Option A: Cloudflare-managed DNS (Recommended)**
If the domain is on Cloudflare DNS:
1. Go to Cloudflare Dashboard → DNS
2. Update or remove CNAME/A records pointing to Vercel
3. The Worker's custom domain routes handle traffic automatically

**Option B: External DNS**
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

## 10. Cloudflare Access Protection (DONE)

Staging and preview Workers are protected by Cloudflare Access. This was configured via `cf` CLI on Oct 8, 2026.

### Current Configuration

**Zero Trust Team**: `teamworkformula.cloudflareaccess.com`

**Access Applications** (self-hosted):

| Application | Hostname | Purpose |
|-------------|----------|---------|
| Staging | `evolution-combatives-admin-staging.jesse-6b1.workers.dev` | Staging Worker |
| Preview | `*evolution-combatives-admin-preview.jesse-6b1.workers.dev` | Preview Worker + all version/preview URLs |

**Allowed Users**:
- `jesseparrot@gmail.com`
- `jesse@jessewalberg.com`

**Service Token**:
- Name: `evolution-combatives-ci`
- Expires: 2027-10-08
- Policy: `non_identity` (both applications)
- Stored as repo-level GitHub secrets: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`

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
