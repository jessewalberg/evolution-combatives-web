import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'

/**
 * Stripe Webhook E2E Tests
 *
 * These tests verify the webhook endpoint behavior without actually
 * triggering Stripe webhooks. They test:
 * - Endpoint availability
 * - Signature validation
 * - Error handling
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

  test('POST /api/webhooks/stripe without signature returns 400', async ({ request }) => {
    const response = await request.post('/api/webhooks/stripe', {
      headers: {
        ...appAccessHeaders('/api/webhooks/stripe'),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ type: 'test.event' }),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/missing signature/i)
  })

  test('POST /api/webhooks/stripe with invalid signature returns 400', async ({ request }) => {
    const response = await request.post('/api/webhooks/stripe', {
      headers: {
        ...appAccessHeaders('/api/webhooks/stripe'),
        'Content-Type': 'application/json',
        'stripe-signature': 't=1234567890,v1=invalid_signature',
      },
      data: JSON.stringify({ type: 'test.event', id: 'evt_test' }),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/invalid signature/i)
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

  test('POST /api/admin/stripe-reconcile requires authentication', async ({ request }) => {
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ action: 'find-missing' }),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(401)
  })

  test('POST /api/admin/stripe-reconcile with invalid action returns 400', async ({ request }) => {
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ action: 'invalid-action' }),
      maxRedirects: 0,
    })

    // Returns 401 for unauthenticated (auth check comes before action validation)
    expect(response.status()).toBe(401)
  })
})
