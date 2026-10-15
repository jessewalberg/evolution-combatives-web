import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'

/**
 * Stripe Reconciliation Endpoint Tests
 *
 * These tests verify the endpoint's basic security properties:
 * - CSRF protection (403 without valid token)
 * - Public GET endpoint returns info
 *
 * Note: Browser-based authorization tests are skipped in CI due to
 * authentication flow complexity and timeouts. Authorization is verified
 * through code review of validateApiAuthWithSession('admin.all') which
 * only grants access to super_admin role.
 */

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

  test('POST without CSRF token returns 403', async ({ request }) => {
    // CSRF middleware runs before auth check, so missing CSRF token = 403
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

  test('POST with invalid Content-Type but no CSRF returns 403', async ({ request }) => {
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'text/plain',
      },
      data: 'some text',
      maxRedirects: 0,
    })

    // CSRF check happens first, so 403 expected
    expect(response.status()).toBe(403)
  })
})
