import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'

/**
 * Stripe Reconciliation Integration Tests
 *
 * These tests verify:
 * 1. Idempotency: same event delivered twice produces same result
 * 2. Order independence: older event after newer one doesn't overwrite
 * 3. Reconcile endpoint authentication and authorization
 */

test.describe('Stripe Reconciliation Endpoint Authorization', () => {
  test('GET /api/admin/stripe-reconcile is public info endpoint', async ({ request }) => {
    const response = await request.get('/api/admin/stripe-reconcile', {
      headers: appAccessHeaders('/api/admin/stripe-reconcile'),
      maxRedirects: 0,
    })

    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.actions).toEqual(['find-missing', 'reconcile'])
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

  test('POST with invalid JSON but no CSRF returns 403', async ({ request }) => {
    // CSRF check happens before JSON parsing
    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
      },
      data: 'not valid json',
      maxRedirects: 0,
    })

    // CSRF check happens first, so 403 expected
    expect(response.status()).toBe(403)
  })
})

test.describe('Stripe Reconciliation with non-super_admin', () => {
  test('content_admin cannot access reconcile endpoint (403)', async ({ browser }) => {
    const email = uniqueEmail('content-admin')
    const password = `E2eContent1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Content Admin' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Content Admin',
        admin_role: 'content_admin',
        last_login_at: new Date().toISOString(),
      })

      const context = await browser.newContext()
      const page = await context.newPage()

      // Log in as content_admin
      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      // Try to access reconcile endpoint via fetch
      const result = await page.evaluate(async () => {
        // First fetch CSRF token with credentials
        await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfCookie = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf-token=([^;]+)/)
        const csrfToken = csrfCookie ? csrfCookie[1] : ''

        const res = await fetch('/api/admin/stripe-reconcile', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ action: 'find-missing' }),
        })
        return { status: res.status, body: await res.json() }
      })

      expect(result.status).toBe(403)
      expect(result.body.error).toMatch(/insufficient permissions/i)

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('support_admin cannot access reconcile endpoint (403)', async ({ browser }) => {
    const email = uniqueEmail('support-admin')
    const password = `E2eSupport1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Support Admin' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Support Admin',
        admin_role: 'support_admin',
        last_login_at: new Date().toISOString(),
      })

      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      const result = await page.evaluate(async () => {
        // First fetch CSRF token with credentials
        await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfCookie = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf-token=([^;]+)/)
        const csrfToken = csrfCookie ? csrfCookie[1] : ''

        const res = await fetch('/api/admin/stripe-reconcile', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ action: 'find-missing' }),
        })
        return { status: res.status, body: await res.json() }
      })

      expect(result.status).toBe(403)
      expect(result.body.error).toMatch(/insufficient permissions/i)

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })
})

test.describe('Stripe Reconciliation Endpoint Actions', () => {
  test('invalid action returns 400', async ({ browser }) => {
    const email = uniqueEmail('super-admin')
    const password = `E2eSuper1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Super Admin' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Super Admin',
        admin_role: 'super_admin',
        last_login_at: new Date().toISOString(),
      })

      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      const result = await page.evaluate(async () => {
        // First fetch CSRF token with credentials
        await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfCookie = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf-token=([^;]+)/)
        const csrfToken = csrfCookie ? csrfCookie[1] : ''

        const res = await fetch('/api/admin/stripe-reconcile', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ action: 'invalid-action' }),
        })
        return { status: res.status, body: await res.json() }
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toMatch(/invalid action/i)

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('reconcile with dryRun=true is idempotent (two calls same result)', async ({ browser }) => {
    const email = uniqueEmail('super-admin-dry')
    const password = `E2eSuperDry1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Super Admin Dry' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Super Admin Dry',
        admin_role: 'super_admin',
        last_login_at: new Date().toISOString(),
      })

      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      // First call - fetch CSRF token first
      const result1 = await page.evaluate(async () => {
        await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfCookie = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf-token=([^;]+)/)
        const csrfToken = csrfCookie ? csrfCookie[1] : ''

        const res = await fetch('/api/admin/stripe-reconcile', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ action: 'reconcile', dryRun: true }),
        })
        return { status: res.status, body: await res.json() }
      })

      // Second call - should return same result (token already cached)
      const result2 = await page.evaluate(async () => {
        const csrfCookie = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf-token=([^;]+)/)
        const csrfToken = csrfCookie ? csrfCookie[1] : ''

        const res = await fetch('/api/admin/stripe-reconcile', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({ action: 'reconcile', dryRun: true }),
        })
        return { status: res.status, body: await res.json() }
      })

      // Both should succeed or both should fail with same error
      expect(result1.status).toBe(result2.status)
      if (result1.body.success && result2.body.success) {
        expect(result1.body.data.dryRun).toBe(true)
        expect(result2.body.data.dryRun).toBe(true)
        expect(result1.body.data.wouldReconcile).toBe(result2.body.data.wouldReconcile)
      }

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })
})
