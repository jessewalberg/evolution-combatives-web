# Security Audit Report — Evolution Combatives Admin Dashboard

## Run Metadata

- **Run ID:** run-1
- **Profile:** standard
- **Scope:** PR #38 Workers migration surface (Workers/TanStack Start app, auth/session, Stripe webhooks, Stream signed URLs, mobile signed-URL routes, wrangler.jsonc, preview/staging config)
- **Source Ref:** 1b25cbb118e28023c50c9078072822995de99bae
- **Execution Policy:** sandboxed-source-and-local-only
- **Prior Runs:** None
- **Budget:** Uncapped

## Security Posture Summary

The Evolution Combatives admin dashboard demonstrates strong security fundamentals in most areas:

- **Authentication:** Supabase Auth with @supabase/ssr provides secure cookie-based sessions with proper 24h timeout
- **CSRF Protection:** Double-submit cookie pattern correctly implemented; webhooks and mobile API properly exempt
- **Webhook Security:** Both Stripe (SDK's constructEventAsync) and Cloudflare (HMAC-SHA256 with constant-time comparison) properly verify signatures
- **Video Security:** Stream signed URLs fail closed (503) when signing keys are missing
- **Admin Client:** Browser usage properly prevented via runtime check

**One confirmed medium-severity finding** was identified: video signed URL endpoints did not verify user subscription tier against video tier requirements, allowing authenticated users to request signed URLs for any video regardless of their subscription level.

## Confirmed Findings

| Severity | Fingerprint | Title | Status |
|----------|-------------|-------|--------|
| MEDIUM | video-signed-url-missing-subscription-authz | Video signed URL endpoints bypass subscription tier authorization | **FIXED** |

### video-signed-url-missing-subscription-authz (MEDIUM)

**Location:** `src/server/mobile/video-signed-url.ts`, `src/server/video/signed-url.ts`

**Description:** Both video signed URL endpoints accepted a `subscriptionTier` parameter from the request body without verifying the authenticated user's actual subscription tier or the video's `tier_required` field.

**Impact:** An authenticated user with any subscription level could request signed URLs for any video with any expiration tier, bypassing subscription-based access controls.

**Root Cause:** Missing server-side authorization check between user's subscription tier and requested video/tier.

**Remediation Applied:**
1. Fetch user's `subscription_tier` from profiles table
2. Fetch video's `tier_required` from videos table
3. Verify `user.subscription_tier >= video.tier_required` before generating signed URL
4. Use user's actual tier for URL expiration (not client-provided value)
5. Return 403 when subscription tier is insufficient

**Files Changed:**
- `src/server/mobile/video-signed-url.ts`
- `src/server/video/signed-url.ts`
- `src/server/mobile/video-signed-url.test.ts`
- `src/server/video/signed-url.test.ts`

## Needs Validation

| Fingerprint | Title | Blockers |
|-------------|-------|----------|
| supabase-rls-video-access | Supabase RLS policies may provide additional access control | RLS policies not visible in repository |

The Supabase videos table may have Row Level Security policies that provide defense-in-depth for video access control. This should be verified in the Supabase dashboard for both staging (hknjeztslvbenmlaqfqa) and production (bxpxpkiubjbcmgsnfpvp) projects.

## Coverage Summary

| Status | Count |
|--------|-------|
| covered | 6 |
| candidate (now fixed) | 2 |
| blocked | 0 |
| deferred | 0 |

**Units Reviewed:**
- CSRF protection (double-submit cookie)
- Admin Supabase client (browser prevention)
- Stripe webhook signature verification
- Cloudflare Stream webhook signature verification
- Admin page route guard (role-based access)
- Video signed URL generation (signing key requirement)
- Mobile video signed URL authorization
- Web video signed URL authorization

## Hardening Notes

1. **Rate Limiting:** Properly configured with Workers ratelimit bindings (100/60s API, 100/60s admin, 10/60s auth)
2. **Security Headers:** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS all properly configured
3. **Session Timeout:** 24-hour session timeout enforced in auth middleware
4. **Production Stripe Placeholders:** Production wrangler.jsonc has placeholder values for Stripe keys (documented deployment blocker in GO-LIVE.md)

## Not In Scope

- Production live probing (Access-protected, out of policy)
- DNS changes
- Supabase RLS policies (external to repository)
- Mobile React Native app
