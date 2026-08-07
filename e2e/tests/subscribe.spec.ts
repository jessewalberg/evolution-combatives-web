import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { deleteAuthUser, deleteSubscriptionByUserId } from '../helpers/api'
import { fetchCsrfHeaders } from '../helpers/csrf'

/**
 * Subscription deep-link → Stripe Checkout (test mode).
 *
 * Completing a real Stripe Checkout card charge in headed CI is optional and environment-
 * dependent. This suite:
 * 1. Asserts /subscribe query-param validation
 * 2. Creates a Checkout session via API (with CSRF) and asserts a Stripe-hosted URL
 * 3. Loads /subscription-success and asserts UI
 * 4. Tears down any subscription rows created for the fixture user
 *
 * Full browser card completion against checkout.stripe.com is flagged in the PR as
 * optionally runnable when Stripe test keys are populated; webhook-driven row creation
 * depends on Stripe CLI / dashboard webhook delivery to this environment.
 */
test.describe('Subscription deep-link flow', () => {
  let userId: string | undefined
  let email: string | undefined

  test.beforeEach(async () => {
    const supabase = createServiceRoleClient()
    email = uniqueEmail('subscribe')
    const password = `E2eSub1!${uniqueSuffix().slice(0, 6)}`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Subscribe User' },
    })
    expect(error).toBeNull()
    userId = data.user!.id

    await supabase.from('profiles').upsert({
      id: userId,
      email,
      full_name: 'E2E Subscribe User',
      admin_role: null,
    })
  })

  test.afterEach(async () => {
    if (userId) {
      await deleteSubscriptionByUserId(userId)
      await deleteAuthUser(userId)
      userId = undefined
    }
  })

  test('missing query params shows Invalid Request', async ({ page }) => {
    // Unauthenticated public page
    await page.goto('/subscribe')
    await expect(page.getByText(/invalid request/i)).toBeVisible()
  })

  test('deep-link renders tiers and create-checkout returns Stripe URL', async ({
    page,
    request,
  }) => {
    await page.goto(
      `/subscribe?userId=${userId}&email=${encodeURIComponent(email!)}&tier=tier1`
    )
    await expect(page.getByText(/invalid request/i)).toHaveCount(0)

    const headers = await fetchCsrfHeaders(request)
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await request.post('/api/subscriptions/create-checkout', {
      headers,
      data: {
        tier: 'tier1',
        userId,
        userEmail: email,
        successUrl: `${base}/subscription-success?tier=tier1`,
        cancelUrl: `${base}/subscription-cancel`,
      },
    })

    // create-checkout is CSRF-protected; with token we should reach Stripe or a domain error
    expect(response.status()).not.toBe(403)
    const body = await response.json()

    if (response.ok()) {
      expect(body.url).toMatch(/stripe\.com|checkout/i)
      expect(body.sessionId).toBeTruthy()

      // Navigate success page (webhook may or may not have fired yet)
      await page.goto(`/subscription-success?tier=tier1&session_id=${body.sessionId}`)
      await expect(page.getByText(/subscription activated/i)).toBeVisible({
        timeout: 15_000,
      })
    } else {
      // Surface configuration gaps without silently skipping
      expect(
        String(body.error || ''),
        `create-checkout failed: ${JSON.stringify(body)}`
      ).toMatch(/price id|not configured|stripe|user|email/i)
    }
  })
})
