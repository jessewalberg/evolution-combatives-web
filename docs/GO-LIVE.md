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
| `CF_ACCESS_CLIENT_ID` | Zero Trust → Service Tokens (optional) | CI access to Access-protected previews |
| `CF_ACCESS_CLIENT_SECRET` | Zero Trust → Service Tokens (optional) | CI access to Access-protected previews |

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

## 4. Cloudflare Stream Signed URLs (REQUIRED - High Severity)

**⚠️ CRITICAL**: Video signed URL generation will fail if Stream signing keys are not configured. This is intentional — falling back to public URLs would allow non-paying users to watch paid videos.

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

3. **Enable requireSignedURLs on Videos**:
   - Go to Stream → Videos
   - For each video, enable "Require signed URLs"
   - Or use the API to bulk-update:
     ```bash
     curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{video_id}" \
       -H "Authorization: Bearer {api_token}" \
       -H "Content-Type: application/json" \
       -d '{"requireSignedURLs": true}'
     ```

4. **Test Video Playback** before cutover:
   - With signing keys configured, request a signed URL via `/api/video/signed-url`
   - Verify the URL includes a `token=` parameter
   - Verify the video plays in a browser

---

## 5. Supabase Auth Configuration

Update these settings in Supabase Dashboard → Authentication → URL Configuration:

### Site URL
- **Value**: `https://evolutioncombatives.com` (no change needed)

### Redirect URLs
Add these allowed redirect URLs:
```
https://evolutioncombatives.com/**
https://www.evolutioncombatives.com/**
https://evolution-combatives-admin.jesse-6b1.workers.dev/**
https://evolution-combatives-admin-staging.jesse-6b1.workers.dev/**
```

---

## 6. DNS Cutover

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

## 7. Stripe Webhook Configuration

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

## 8. Cloudflare Stream Webhook Configuration

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

## 9. Protect Staging and Preview URLs with Cloudflare Access

The staging Worker (`evolution-combatives-admin-staging`) and preview Worker (`evolution-combatives-admin-preview`) are publicly accessible via their `workers.dev` URLs. Only the app's login page stands between unauthenticated users and the admin interface.

### Enable Cloudflare Access

1. Go to **Cloudflare Dashboard → Workers & Pages**
2. Select `evolution-combatives-admin-staging`
3. Go to **Settings → Domains & Routes**
4. For `workers.dev`, click **Enable Cloudflare Access**
5. Click **Manage Cloudflare Access** to configure the policy:
   - Add your email and team members' emails
   - Or set policy to "Emails ending in @yourdomain.com"
6. Repeat for `evolution-combatives-admin-preview`
7. For Preview URLs on the preview Worker, also enable Access

### Create a Service Token for CI/CD

Once Access is enabled, GitHub Actions and Playwright E2E tests need a service token to authenticate:

1. Go to **Cloudflare Dashboard → Zero Trust → Access → Service Tokens**
2. Click **Create a Service Token**
3. Name it `CI/CD token` and set duration (e.g., 1 year)
4. Copy the `Client ID` and `Client Secret`

### Add Service Token to Access Policy

1. Go to **Zero Trust → Access → Applications**
2. Find the "Cloudflare Workers Preview URLs" policy (auto-created)
3. Edit the policy and add a rule:
   - **Include** → **Service Token** → Select your CI/CD token
4. Repeat for the staging Worker's policy if separate

### Add Service Token to GitHub Secrets

Add to the `preview` environment:
- `CF_ACCESS_CLIENT_ID` — The Client ID from the service token
- `CF_ACCESS_CLIENT_SECRET` — The Client Secret from the service token

The CI workflows will automatically send these headers when the secrets are set. When the secrets are absent (e.g., before configuring Access), the workflows skip the headers and work normally.

---

## 10. PostHog & Sentry Configuration

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

4. **Video Playback (CRITICAL)**
   - [ ] Request signed URL via API
   - [ ] Verify URL contains `token=` parameter
   - [ ] Verify video plays in browser
   - [ ] Verify unsigned URL is rejected (403)

5. **Webhooks**
   - [ ] Test Stripe webhook delivery (use Stripe CLI or dashboard test)
   - [ ] Test Cloudflare Stream webhook (upload a test video)

6. **Security Headers**
   - [ ] `X-Frame-Options: DENY`
   - [ ] `Content-Security-Policy` present
   - [ ] `Strict-Transport-Security` present
   - [ ] `X-Content-Type-Options: nosniff`

7. **Admin Functions**
   - [ ] Video upload works
   - [ ] User management works
   - [ ] Q&A moderation works

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
| Set Worker secrets | 10 minutes |
| Set GitHub secrets | 5 minutes |
| Configure Stream signing keys | 10 minutes |
| Verify videos have requireSignedURLs | 15 minutes |
| Update Supabase URLs | 5 minutes |
| Create Stripe webhook | 5 minutes |
| Create Stream webhook | 5 minutes |
| Enable Access on staging/preview | 10 minutes |
| DNS cutover | 5-15 minutes (propagation) |
| Smoke testing | 15 minutes |
| **Total** | ~1.5 hours |
