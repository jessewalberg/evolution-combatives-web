import { test, expect } from '@playwright/test'
import { fetchCsrfHeaders } from '../helpers/csrf'

/**
 * CSRF regression - API-level Playwright request tests.
 * Mutating /api/* without X-CSRF-Token must be rejected (403).
 */
test.describe('CSRF protection', () => {
  // These tests intentionally do not need a browser session cookie for the negative case.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('POST /api/content/disciplines without CSRF token is rejected', async ({
    request,
  }) => {
    const response = await request.post('/api/content/disciplines', {
      data: {
        name: 'Should Not Create',
        slug: 'should-not-create',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(String(body.error)).toMatch(/csrf/i)
  })

  test('POST /api/admin/content without CSRF token is rejected', async ({ request }) => {
    const response = await request.post('/api/admin/content', {
      data: { action: 'fetchContentStats' },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(String(body.error)).toMatch(/csrf/i)
  })

  test('control: POST with valid CSRF token is not rejected as CSRF failure', async ({
    request,
  }) => {
    const headers = await fetchCsrfHeaders(request)

    const response = await request.post('/api/content/disciplines', {
      data: {
        name: 'CSRF Control Should Not Persist',
        slug: 'csrf-control-no-persist',
      },
      headers,
    })

    // CSRF middleware returns 403 + "CSRF token validation failed".
    // A valid token must not hit that path (auth may still reject with 401).
    if (response.status() === 403) {
      const body = await response.json()
      expect(String(body.error || '')).not.toMatch(/csrf token validation failed/i)
    } else {
      expect(response.status()).not.toBe(403)
    }
  })
})
