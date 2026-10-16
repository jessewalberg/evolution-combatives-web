import { test, expect } from '../test'
import { appAccessHeaders } from '../helpers/access'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'
import { createClient } from '@supabase/supabase-js'

/**
 * Stripe Reconciliation Endpoint Tests
 *
 * These tests verify the endpoint's security properties:
 * 1. CSRF protection (403 without valid token)
 * 2. Authentication (401 for missing session)
 * 3. Authorization (403 for non-super_admin roles)
 */

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:3000'

/**
 * Sign in a user via Supabase auth and return session cookies
 */
async function getSessionCookies(email: string, password: string): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key required')
  }

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  
  if (error || !data.session) {
    throw new Error(`Sign in failed: ${error?.message || 'No session'}`)
  }

  // Format cookies for the request
  // Supabase auth uses sb-<project-ref>-auth-token cookie
  const projectRef = new URL(url).hostname.split('.')[0]
  const accessToken = data.session.access_token
  const refreshToken = data.session.refresh_token
  
  // The cookie format Supabase expects
  const cookieValue = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
  })
  
  return `sb-${projectRef}-auth-token=${encodeURIComponent(cookieValue)}`
}

/**
 * Get a CSRF token by making a request to the CSRF endpoint
 */
async function getCsrfToken(cookies: string): Promise<{ csrfToken: string; csrfCookie: string }> {
  const response = await fetch(`${BASE_URL}/api/csrf-token`, {
    headers: {
      ...appAccessHeaders('/api/csrf-token'),
      'Cookie': cookies,
    },
  })
  
  const data = await response.json()
  const setCookieHeader = response.headers.get('set-cookie') || ''
  
  // Extract the CSRF cookie from Set-Cookie header
  const csrfCookieMatch = setCookieHeader.match(/((?:__Host-)?csrf-token=[^;]+)/)
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[1] : ''
  
  return { csrfToken: data.csrfToken || '', csrfCookie }
}

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
  test('POST without session returns 401', async () => {
    // First get a CSRF token without auth
    const { csrfToken, csrfCookie } = await getCsrfToken('')
    
    // Make request with CSRF but no auth session
    const response = await fetch(`${BASE_URL}/api/admin/stripe-reconcile`, {
      method: 'POST',
      headers: {
        ...appAccessHeaders('/api/admin/stripe-reconcile'),
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': csrfCookie,
      },
      body: JSON.stringify({ action: 'find-missing' }),
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toMatch(/authentication required/i)
  })
})

test.describe('Stripe Reconciliation Endpoint - Authorization', () => {
  test('content_admin with valid session returns 403 insufficient permissions', async () => {
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('content-admin-api')
    const password = `E2eContent1!${uniqueSuffix().slice(0, 6)}`

    // Create test user
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Content Admin API Test' },
    })
    expect(createError).toBeNull()
    const userId = created.user!.id

    try {
      // Wait for profile trigger, then set content_admin role
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Content Admin API Test',
        admin_role: 'content_admin',
        subscription_tier: 'none',
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      expect(upsertError).toBeNull()

      // Verify profile has correct role
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('content_admin')

      // Sign in to get session cookies
      const sessionCookies = await getSessionCookies(email, password)
      
      // Get CSRF token with session
      const { csrfToken, csrfCookie } = await getCsrfToken(sessionCookies)
      const allCookies = [sessionCookies, csrfCookie].filter(Boolean).join('; ')

      // Make authenticated request
      const response = await fetch(`${BASE_URL}/api/admin/stripe-reconcile`, {
        method: 'POST',
        headers: {
          ...appAccessHeaders('/api/admin/stripe-reconcile'),
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': allCookies,
        },
        body: JSON.stringify({ action: 'find-missing' }),
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toMatch(/insufficient permissions/i)

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('support_admin with valid session returns 403 insufficient permissions', async () => {
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('support-admin-api')
    const password = `E2eSupport1!${uniqueSuffix().slice(0, 6)}`

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Support Admin API Test' },
    })
    expect(createError).toBeNull()
    const userId = created.user!.id

    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Support Admin API Test',
        admin_role: 'support_admin',
        subscription_tier: 'none',
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      expect(upsertError).toBeNull()

      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('support_admin')

      const sessionCookies = await getSessionCookies(email, password)
      const { csrfToken, csrfCookie } = await getCsrfToken(sessionCookies)
      const allCookies = [sessionCookies, csrfCookie].filter(Boolean).join('; ')

      const response = await fetch(`${BASE_URL}/api/admin/stripe-reconcile`, {
        method: 'POST',
        headers: {
          ...appAccessHeaders('/api/admin/stripe-reconcile'),
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': allCookies,
        },
        body: JSON.stringify({ action: 'find-missing' }),
      })

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toMatch(/insufficient permissions/i)

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('super_admin with valid session passes auth', async () => {
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('super-admin-api')
    const password = `E2eSuper1!${uniqueSuffix().slice(0, 6)}`

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Super Admin API Test' },
    })
    expect(createError).toBeNull()
    const userId = created.user!.id

    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Super Admin API Test',
        admin_role: 'super_admin',
        subscription_tier: 'none',
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      expect(upsertError).toBeNull()

      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', userId)
        .single()
      expect(profile?.admin_role).toBe('super_admin')

      const sessionCookies = await getSessionCookies(email, password)
      const { csrfToken, csrfCookie } = await getCsrfToken(sessionCookies)
      const allCookies = [sessionCookies, csrfCookie].filter(Boolean).join('; ')

      const response = await fetch(`${BASE_URL}/api/admin/stripe-reconcile`, {
        method: 'POST',
        headers: {
          ...appAccessHeaders('/api/admin/stripe-reconcile'),
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': allCookies,
        },
        body: JSON.stringify({ action: 'find-missing' }),
      })

      // super_admin passes auth - may get 500 if STRIPE_SECRET_KEY missing,
      // but must NOT get 401 or 403
      expect([200, 500]).toContain(response.status)
      const body = await response.json()
      if (response.status === 500) {
        expect(body.error).toMatch(/stripe/i)
      } else {
        expect(body.success).toBe(true)
      }

    } finally {
      await deleteAuthUser(userId)
    }
  })
})
