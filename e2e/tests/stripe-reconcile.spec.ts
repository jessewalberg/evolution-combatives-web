import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'
import { fetchCsrfHeaders } from '../helpers/csrf'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'

/**
 * Stripe Reconciliation Endpoint Tests
 *
 * These tests verify:
 * 1. CSRF protection (403 without valid token)
 * 2. Authentication (401 with CSRF but no session)
 * 3. Authorization (403 for non-super_admin with valid CSRF + session)
 * 4. Endpoint functionality for super_admin
 */

test.describe('Stripe Reconciliation Endpoint - Basic', () => {
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
})

test.describe('Stripe Reconciliation Endpoint - Authentication', () => {
  test('POST with valid CSRF but no session returns 401', async ({ request }) => {
    // Get a valid CSRF token (this sets the cookie too)
    const csrfHeaders = await fetchCsrfHeaders(request)

    const response = await request.post('/api/admin/stripe-reconcile', {
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        ...csrfHeaders,
      },
      data: JSON.stringify({ action: 'find-missing' }),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/authentication/i)
  })
})

test.describe('Stripe Reconciliation Endpoint - Authorization', () => {
  test('content_admin with valid CSRF + session returns 403 insufficient permissions', async ({
    browser,
  }) => {
    const email = uniqueEmail('content-admin-auth')
    const password = `E2eContent1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Content Admin Auth Test' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Content Admin Auth Test',
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

      // Make authenticated request with CSRF token
      const result = await page.evaluate(async () => {
        // Get CSRF token from API
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfData = await csrfRes.json() as { csrfToken?: string }
        const csrfToken = csrfData.csrfToken || ''

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

  test('support_admin with valid CSRF + session returns 403 insufficient permissions', async ({
    browser,
  }) => {
    const email = uniqueEmail('support-admin-auth')
    const password = `E2eSupport1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Support Admin Auth Test' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Support Admin Auth Test',
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
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfData = await csrfRes.json() as { csrfToken?: string }
        const csrfToken = csrfData.csrfToken || ''

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

  test('super_admin with valid CSRF + session can access endpoint', async ({ browser }) => {
    const email = uniqueEmail('super-admin-auth')
    const password = `E2eSuper1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Super Admin Auth Test' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Super Admin Auth Test',
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
        const csrfRes = await fetch('/api/csrf-token', { credentials: 'include' })
        const csrfData = await csrfRes.json() as { csrfToken?: string }
        const csrfToken = csrfData.csrfToken || ''

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

      // Super admin should get through auth - may fail due to missing STRIPE_SECRET_KEY
      // but should NOT get 401 or 403
      expect([200, 500]).toContain(result.status)
      if (result.status === 500) {
        // Expected when STRIPE_SECRET_KEY is not configured
        expect(result.body.error).toMatch(/stripe/i)
      } else {
        expect(result.body.success).toBe(true)
      }

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })
})
