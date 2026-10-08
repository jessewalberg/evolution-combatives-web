# Evolution Combatives Admin - Cloudflare Workers Go-Live Checklist

This checklist documents all steps required to deploy the Evolution Combatives admin dashboard from Vercel to Cloudflare Workers.

## Pre-Deployment Prerequisites

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

## 2. GitHub Environment Secrets

Create two GitHub Environments: `production` and `preview`

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
wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY
wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID
wrangler secret put CLOUDFLARE_STREAM_WEBHOOK_SECRET  # After creating webhook endpoint
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

## 4. Supabase Auth Configuration

Update these settings in Supabase Dashboard → Authentication → URL Configuration:

### Site URL
- **Current (Vercel)**: `https://evolutioncombatives.com`
- **New (Workers)**: `https://evolutioncombatives.com` (same domain)

### Redirect URLs
Add these allowed redirect URLs:
```
https://evolutioncombatives.com/**
https://www.evolutioncombatives.com/**
https://evolution-combatives-admin.jesse-6b1.workers.dev/**
https://evolution-combatives-admin-staging.jesse-6b1.workers.dev/**
```

---

## 5. DNS Cutover

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

## 6. Stripe Webhook Configuration

### Create New Webhook Endpoint
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://evolutioncombatives.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
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

## 7. Cloudflare Stream Webhook Configuration

### Create Webhook
1. Go to Cloudflare Dashboard → Stream → Notifications
2. Add notification webhook: `https://evolutioncombatives.com/api/webhooks/cloudflare`
3. Select events:
   - `video.upload.complete`
   - `video.processing.started`
   - `video.processing.complete`
   - `video.processing.failed`
   - `video.ready`
   - `video.deleted`
4. Copy the signing secret → Set as `CLOUDFLARE_STREAM_WEBHOOK_SECRET`

---

## 8. PostHog & Sentry Configuration

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

1. **Login Flow**
   - [ ] Navigate to `https://evolutioncombatives.com`
   - [ ] Redirects to `/login`
   - [ ] Login with admin credentials
   - [ ] Verify dashboard loads

2. **API Endpoints**
   - [ ] `/api/health` returns 200
   - [ ] `/api/csrf-token` returns token
   - [ ] Authenticated endpoints require session

3. **Mobile API**
   - [ ] `/api/mobile/video/signed-url` accepts Bearer token
   - [ ] `/api/mobile/subscriptions/create-checkout` accepts Bearer token

4. **Webhooks**
   - [ ] Test Stripe webhook delivery (use Stripe CLI or dashboard test)
   - [ ] Test Cloudflare Stream webhook (upload a test video)

5. **Security Headers**
   - [ ] `X-Frame-Options: DENY`
   - [ ] `Content-Security-Policy` present
   - [ ] `Strict-Transport-Security` present
   - [ ] `X-Content-Type-Options: nosniff`

6. **Admin Functions**
   - [ ] Video upload works
   - [ ] User management works
   - [ ] Q&A moderation works

---

## Contacts

- **Cloudflare Account Owner**: Jesse Walberg
- **Supabase Project**: `bxpxpkiubjbcmgsnfpvp`
- **Stripe Account**: Production keys in 1Password

---

## Timeline Reference

| Step | Estimated Time |
|------|----------------|
| Set Worker secrets | 10 minutes |
| Set GitHub secrets | 5 minutes |
| Update Supabase URLs | 5 minutes |
| Create Stripe webhook | 5 minutes |
| Create Stream webhook | 5 minutes |
| DNS cutover | 5-15 minutes (propagation) |
| Smoke testing | 15 minutes |
| **Total** | ~1 hour |
