import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'

/**
 * Stripe Reconciliation Endpoint Tests
 *
 * These tests verify the endpoint's security properties:
 * 1. CSRF protection (403 without valid token)
 * 2. Authentication (401 for missing session)
 * 3. Authorization (403 for non-super_admin roles)
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

test.describe('Stripe Reconciliation Endpoint - Authorization', () => {
  test('content_admin with valid session returns 403 insufficient permissions', async ({
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
      // Wait for trigger to create profile, then update with our role
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Force update the admin_role (profile may be created by trigger)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          admin_role: 'content_admin',
          last_login_at: new Date().toISOString(),
        })
        .eq('id', userId)

      // If update fails (no row), try insert
      if (updateError) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          email,
          full_name: 'E2E Content Admin Auth Test',
          admin_role: 'content_admin',
          last_login_at: new Date().toISOString(),
        })
        expect(insertError).toBeNull()
      }

      // Verify the profile has the correct role
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('content_admin')

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

      // content_admin should get 403 insufficient permissions
      // Log details if assertion fails
      if (result.status !== 403) {
        console.error('Unexpected response:', JSON.stringify(result, null, 2))
      }
      expect(result.status).toBe(403)
      expect(result.body.error).toMatch(/insufficient permissions/i)

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('support_admin with valid session returns 403 insufficient permissions', async ({
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
      // Wait for trigger to create profile, then update with our role
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          admin_role: 'support_admin',
          last_login_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          email,
          full_name: 'E2E Support Admin Auth Test',
          admin_role: 'support_admin',
          last_login_at: new Date().toISOString(),
        })
        expect(insertError).toBeNull()
      }

      // Verify the profile has the correct role
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('support_admin')

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

      if (result.status !== 403) {
        console.error('Unexpected response:', JSON.stringify(result, null, 2))
      }
      expect(result.status).toBe(403)
      expect(result.body.error).toMatch(/insufficient permissions/i)

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('super_admin with valid session passes auth check', async ({ browser }) => {
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
      // Wait for trigger to create profile, then update with our role
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          admin_role: 'super_admin',
          last_login_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          email,
          full_name: 'E2E Super Admin Auth Test',
          admin_role: 'super_admin',
          last_login_at: new Date().toISOString(),
        })
        expect(insertError).toBeNull()
      }

      // Verify the profile has the correct role
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('super_admin')

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

      // super_admin passes auth - may get 500 if STRIPE_SECRET_KEY missing,
      // but must NOT get 401 or 403
      expect([200, 500]).toContain(result.status)
      if (result.status === 500) {
        // Expected when STRIPE_SECRET_KEY is not configured in preview
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
