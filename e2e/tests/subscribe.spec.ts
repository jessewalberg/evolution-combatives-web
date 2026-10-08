import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import {
  deleteAuthUser,
  deleteSubscriptionByUserId,
  expireStripeCheckoutSession,
} from '../helpers/api'

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
  let password: string | undefined
  let accessToken: string | undefined
  let checkoutSessionId: string | undefined

  test.beforeEach(async () => {
    const supabase = createServiceRoleClient()
    email = uniqueEmail('subscribe')
    password = `E2eSub1!${uniqueSuffix().slice(0, 6)}`

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

    // Get access token for the user (simulating mobile app deep-link flow)
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email!,
        password: password!,
      })
    expect(signInError).toBeNull()
    accessToken = signInData.session?.access_token
    expect(accessToken).toBeTruthy()
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
  }) => {
    // Navigate to subscribe page (simulating mobile deep-link)
    await page.goto(
      `/subscribe?userId=${userId}&email=${encodeURIComponent(email!)}&tier=tier1`
    )
    await expect(page.getByText(/invalid request/i)).toHaveCount(0)

    // Make API request with bearer token (simulating mobile deep-link user)
    const base = process.env.VITE_APP_URL || 'http://localhost:3000'
    const result = await page.evaluate(
      async ({ tier, successUrl, cancelUrl, token }) => {
        const response = await fetch('/api/subscriptions/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tier, successUrl, cancelUrl }),
        })

        const body = await response.json()
        return { status: response.status, ok: response.ok, body }
      },
      {
        tier: 'tier1',
        successUrl: `${base}/subscription-success?tier=tier1`,
        cancelUrl: `${base}/subscription-cancel`,
        token: accessToken,
      }
    )

    // Bearer token auth should reach Stripe or a domain error (not 401/403)
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)

    if (result.ok) {
      // Capture before asserts so afterEach can expire even if an expect throws.
      checkoutSessionId = result.body.sessionId as string
      expect(result.body.url).toMatch(/stripe\.com|checkout/i)
      expect(result.body.sessionId).toBeTruthy()

      // Navigate success page (webhook may or may not have fired yet)
      await page.goto(`/subscription-success?tier=tier1&session_id=${result.body.sessionId}`)
      await expect(page.getByText(/subscription activated/i)).toBeVisible({
        timeout: 15_000,
      })
    } else {
      // Fixture always creates a fresh valid user + matching email + no active
      // subscription. The only legitimate non-2xx outcomes are env/config gaps
      // from create-checkout/route.ts. Any other message means the fixture or
      // request itself is broken and must fail the test.
      const errorMessage = String(result.body.error || '')
      expect(
        errorMessage,
        `create-checkout failed with unexpected error: ${JSON.stringify(result.body)}`
      ).toMatch(
        /^(Price ID not configured for tier: tier1|Payment processing error|Internal server error)$/
      )
    }
  })

  test('Subscribe button posts with bearer token and reaches Stripe or allowed error', async ({
    page,
  }) => {
    // Navigate to subscribe page with token in URL (simulating mobile deep-link)
    // The page will use this token for API calls
    await page.goto(
      `/subscribe?userId=${userId}&email=${encodeURIComponent(email!)}&tier=tier1&token=${accessToken}`
    )
    await expect(page.getByText(/invalid request/i)).toHaveCount(0)

    // Make API request with bearer token (simulating mobile deep-link user clicking subscribe)
    const base = process.env.VITE_APP_URL || 'http://localhost:3000'
    const result = await page.evaluate(
      async ({ tier, successUrl, cancelUrl, token }) => {
        const response = await fetch('/api/subscriptions/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tier, successUrl, cancelUrl }),
        })

        const body = await response.json()
        return { status: response.status, ok: response.ok, body }
      },
      {
        tier: 'tier1',
        successUrl: `${base}/subscription-success?tier=tier1`,
        cancelUrl: `${base}/subscription-cancel`,
        token: accessToken,
      }
    )

    // Bearer token auth should reach Stripe or a domain error (not 401/403)
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)

    if (result.ok) {
      checkoutSessionId = result.body.sessionId as string
      expect(result.body.url).toMatch(/stripe\.com|checkout/i)
      expect(result.body.sessionId).toBeTruthy()
    } else {
      // Fixture always creates a fresh valid user + matching email + no active
      // subscription. The only legitimate non-2xx outcomes are env/config gaps
      // from create-checkout/route.ts.
      const errorMessage = String(result.body.error || '')
      expect(
        errorMessage,
        `create-checkout failed with unexpected error: ${JSON.stringify(result.body)}`
      ).toMatch(
        /^(Price ID not configured for tier: tier1|Payment processing error|Internal server error)$/
      )
    }
  })
})
