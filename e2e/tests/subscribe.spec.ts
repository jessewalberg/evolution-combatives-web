import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import {
  deleteAuthUser,
  deleteSubscriptionByUserId,
  expireStripeCheckoutSession,
} from '../helpers/api'
import { fetchCsrfHeaders } from '../helpers/csrf'

/**
 * Subscription deep-link -> Stripe Checkout (test mode).
 *
 * Completing a real Stripe Checkout card charge in headed CI is optional and environment-
 * dependent. This suite:
 * 1. Asserts /subscribe query-param validation
 * 2. Creates a Checkout session via API (with CSRF) and asserts a Stripe-hosted URL
 * 3. Loads /subscription-success and asserts UI
 * 4. Tears down any subscription rows created for the fixture user
 * 5. Expires any Stripe Checkout Session created (test-mode) so it is not left open
 *
 * Full browser card completion against checkout.stripe.com is flagged in the PR as
 * optionally runnable when Stripe test keys are populated; webhook-driven row creation
 * depends on Stripe CLI / dashboard webhook delivery to this environment.
 */
test.describe('Subscription deep-link flow', () => {
  let userId: string | undefined
  let email: string | undefined
  let checkoutSessionId: string | undefined

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
    const failures: string[] = []

    if (checkoutSessionId) {
      try {
        await expireStripeCheckoutSession(checkoutSessionId)
      } catch (err) {
        failures.push(
          `expireStripeCheckoutSession: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      checkoutSessionId = undefined
    }
    if (userId) {
      try {
        await deleteSubscriptionByUserId(userId)
      } catch (err) {
        failures.push(
          `deleteSubscriptionByUserId: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      try {
        await deleteAuthUser(userId)
      } catch (err) {
        failures.push(
          `deleteAuthUser: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      userId = undefined
    }

    if (failures.length) {
      throw new Error(`Subscribe teardown failed: ${failures.join('; ')}`)
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
    const base = process.env.VITE_APP_URL || 'http://localhost:3000'
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
      // Capture before asserts so afterEach can expire even if an expect throws.
      checkoutSessionId = body.sessionId as string
      expect(body.url).toMatch(/stripe\.com|checkout/i)
      expect(body.sessionId).toBeTruthy()

      // Navigate success page (webhook may or may not have fired yet)
      await page.goto(`/subscription-success?tier=tier1&session_id=${body.sessionId}`)
      await expect(page.getByText(/subscription activated/i)).toBeVisible({
        timeout: 15_000,
      })
    } else {
      // Fixture always creates a fresh valid user + matching email + no active
      // subscription. The only legitimate non-2xx outcomes are env/config gaps
      // from create-checkout/route.ts. Any other message means the fixture or
      // request itself is broken and must fail the test.
      const errorMessage = String(body.error || '')
      expect(
        errorMessage,
        `create-checkout failed with unexpected error: ${JSON.stringify(body)}`
      ).toMatch(
        /^(Price ID not configured for tier: tier1|Payment processing error|Internal server error)$/
      )
    }
  })

  test('Subscribe button posts with CSRF and reaches Stripe or allowed error', async ({
    page,
  }) => {
    await page.goto(
      `/subscribe?userId=${userId}&email=${encodeURIComponent(email!)}&tier=tier1`
    )
    await expect(page.getByText(/invalid request/i)).toHaveCount(0)

    const subscribeButton = page.getByRole('button', { name: /subscribe to/i }).first()
    await expect(subscribeButton).toBeVisible()

    const checkoutResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/subscriptions/create-checkout') &&
        res.request().method() === 'POST',
      { timeout: 30_000 }
    )

    await subscribeButton.click()

    const checkoutResponse = await checkoutResponsePromise

    // UI path must send CSRF; a missing token would 403 before Stripe/domain logic
    expect(checkoutResponse.status()).not.toBe(403)

    const csrfErrorBanner = page.getByText(/csrf token validation failed/i)
    await expect(csrfErrorBanner).toHaveCount(0)

    // Don't read checkoutResponse.json() here: app/subscribe/page.tsx's own success
    // handler reads this same response body and immediately does
    // `window.location.href = data.url`, which can evict the buffered body before
    // this test's CDP read completes ("Response body is not available for a
    // response that was navigated away from" - flaky in CI). Assert success via
    // UI-visible signals instead.
    if (checkoutResponse.ok()) {
      await page.waitForURL(/stripe\.com|checkout/i, { timeout: 15_000 })
      const sessionId = page.url().match(/cs_[a-zA-Z0-9_]+/)?.[0]
      expect(
        sessionId,
        `could not extract Stripe session id from redirect URL: ${page.url()}`
      ).toBeTruthy()
      checkoutSessionId = sessionId
    } else {
      // Allowed env/config gaps from create-checkout/route.ts (same tolerance as API
      // test), read from the page's own error banner rather than the response body.
      const allowedErrors =
        /^(Price ID not configured for tier: tier1|Payment processing error|Internal server error)$/
      const actualErrorText = await page
        .locator('p.text-red-600')
        .textContent()
        .catch(() => null)
      await expect(
        page.getByText(allowedErrors),
        `UI create-checkout failed with unexpected error: ${JSON.stringify(actualErrorText)}`
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})
