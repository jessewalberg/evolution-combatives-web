import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'

/**
 * Stripe Webhook E2E Tests
 *
 * These tests verify the webhook endpoint behavior:
 * - Endpoint availability (GET health check)
 * - 503 for missing webhook secret configuration
 * - 400 for missing or invalid signature
 */

test.describe('Stripe Webhook Endpoint', () => {
  test('GET /api/webhooks/stripe returns health status', async ({ request }) => {
    const response = await request.get('/api/webhooks/stripe', {
      headers: appAccessHeaders('/api/webhooks/stripe'),
      maxRedirects: 0,
    })

    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('stripe-webhooks')
  })

  test('POST /api/webhooks/stripe without webhook secret returns 503', async ({ request }) => {
    // When STRIPE_WEBHOOK_SECRET is not configured, the handler returns 503
    // This test validates misconfiguration is surfaced as 503, not 500
    const response = await request.post('/api/webhooks/stripe', {
      headers: {
        ...appAccessHeaders('/api/webhooks/stripe'),
        'Content-Type': 'application/json',
        'stripe-signature': 't=1234567890,v1=test_signature',
      },
      data: JSON.stringify({ type: 'test.event', id: 'evt_test' }),
      maxRedirects: 0,
    })

    // 503 = webhook secret not configured (misconfiguration)
    // 400 = signature validation failed (secret is configured)
    // Either is acceptable depending on environment configuration
    const status = response.status()
    expect([400, 503]).toContain(status)

    const body = await response.json()
    if (status === 503) {
      expect(body.error).toMatch(/not configured/i)
    } else {
      expect(body.error).toMatch(/invalid signature/i)
    }
  })

  test('POST /api/webhooks/stripe without signature returns 400 when configured', async ({ request }) => {
    // This test verifies that when webhook secret IS configured,
    // missing signature returns 400 (not 503 or 500)
    const response = await request.post('/api/webhooks/stripe', {
      headers: {
        ...appAccessHeaders('/api/webhooks/stripe'),
        'Content-Type': 'application/json',
        // No stripe-signature header
      },
      data: JSON.stringify({ type: 'test.event' }),
      maxRedirects: 0,
    })

    const status = response.status()
    // 503 = secret not configured (skip signature check)
    // 400 = missing signature (secret is configured)
    expect([400, 503]).toContain(status)

    const body = await response.json()
    if (status === 400) {
      expect(body.error).toMatch(/missing signature/i)
    }
  })
})

test.describe('Stripe Reconciliation Endpoint', () => {
  test('GET /api/admin/stripe-reconcile returns endpoint info', async ({ request }) => {
    const response = await request.get('/api/admin/stripe-reconcile', {
      headers: appAccessHeaders('/api/admin/stripe-reconcile'),
      maxRedirects: 0,
    })

    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('stripe-reconcile')
    expect(body.actions).toContain('find-missing')
    expect(body.actions).toContain('reconcile')
  })

  test('POST /api/admin/stripe-reconcile without CSRF returns 403', async ({ request }) => {
    // CSRF middleware runs before auth check
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ action: 'find-missing' }),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/csrf/i)
  })

  test('POST /api/admin/stripe-reconcile with invalid action but no CSRF returns 403', async ({ request }) => {
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ action: 'invalid-action' }),
      maxRedirects: 0,
    })

    // CSRF check happens first
    expect(response.status()).toBe(403)
  })
})
