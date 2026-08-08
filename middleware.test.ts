import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { generateCSRFToken } from '@/src/lib/csrf-protection'

const { mockCreateMiddlewareClient } = vi.hoisted(() => ({
  mockCreateMiddlewareClient: vi.fn(),
}))

vi.mock('./src/lib/supabase', () => ({
  createMiddlewareClient: mockCreateMiddlewareClient,
}))

import { middleware } from './middleware'

type ProfileData = {
  admin_role: string
  full_name: string
  last_login_at: string
}

function createSupabaseMiddlewareMock(options: {
  session?: { user: { id: string; email: string } } | null
  sessionError?: { message: string } | null
  profile?: ProfileData | null
  profileError?: { message: string } | null
  signOutError?: Error | null
} = {}) {
  const {
    session = null,
    sessionError = null,
    profile = {
      admin_role: 'super_admin',
      full_name: 'Admin User',
      last_login_at: new Date().toISOString(),
    },
    profileError = null,
    signOutError = null,
  } = options

  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: profile, error: profileError })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select, update })
  const signOut = signOutError
    ? vi.fn().mockRejectedValue(signOutError)
    : vi.fn().mockResolvedValue({ error: null })

  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: sessionError,
      }),
      signOut,
    },
    from,
  }

  return { client, signOut, from, update, eq, single }
}

function authenticatedSession(overrides?: Partial<{ id: string; email: string }>) {
  return {
    user: {
      id: overrides?.id ?? 'user-123',
      email: overrides?.email ?? 'admin@test.com',
    },
  }
}

function withUniqueIp(headers: Record<string, string> = {}) {
  return {
    ...headers,
    'x-forwarded-for': `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  }
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMiddlewareClient.mockImplementation(() => {
      const { client } = createSupabaseMiddlewareMock()
      return client
    })
  })

  describe('public routes', () => {
    it.each([
      '/login',
      '/api/health',
      '/api/webhooks/stripe',
    ])('allows %s without authentication', async (pathname) => {
      const response = await middleware(
        createNextRequest(pathname, { headers: withUniqueIp() })
      )

      expect(response.status).toBe(200)
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled()
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it.each([
      '/public/some-asset.png',
      '/_next/static/chunk.js',
      '/_next/image?url=%2Flogo.png',
      '/.well-known/security.txt',
    ])('allows wildcard public path %s without authentication', async (pathname) => {
      const response = await middleware(
        createNextRequest(pathname, { headers: withUniqueIp() })
      )

      expect(response.status).toBe(200)
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled()
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it.each(['/publicity', '/public-admin'])(
      'requires authentication for %s (does not match /public* without path boundary)',
      async (pathname) => {
        mockCreateMiddlewareClient.mockImplementation(() => {
          const { client } = createSupabaseMiddlewareMock({ session: null })
          return client
        })

        const response = await middleware(
          createNextRequest(pathname, { headers: withUniqueIp() })
        )

        expect(response.status).toBe(307)
        const location = response.headers.get('location') ?? ''
        expect(location).toContain('/login')
        expect(location).toContain(`redirectTo=${encodeURIComponent(pathname)}`)
      }
    )
  })

  describe('CSRF protection', () => {
    it('returns 403 for POST /api/content/videos without CSRF token', async () => {
      const response = await middleware(
        createNextRequest('/api/content/videos', {
          method: 'POST',
          headers: withUniqueIp(),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('CSRF token validation failed')
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled()
    })

    it('accepts matching __Host-csrf-token when x-forwarded-proto is https', async () => {
      const token = generateCSRFToken()
      const response = await middleware(
        createNextRequest('/api/content/videos', {
          method: 'POST',
          headers: withUniqueIp({
            'X-CSRF-Token': token,
            'x-forwarded-proto': 'https',
          }),
          cookies: { '__Host-csrf-token': token },
        })
      )

      // Past CSRF; may still redirect/auth-fail, but must not be 403 CSRF reject
      expect(response.status).not.toBe(403)
      const bodyText = await response.clone().text()
      expect(bodyText).not.toContain('CSRF token validation failed')
    })
  })

  describe('rate limiting', () => {
    it('sets rate limit headers on API responses', async () => {
      const response = await middleware(
        createNextRequest('/api/content/videos', {
          headers: withUniqueIp(),
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy()
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('sets stricter admin rate limit headers on /api/admin routes', async () => {
      const response = await middleware(
        createNextRequest('/api/admin/users', {
          headers: withUniqueIp(),
        })
      )

      expect(response.headers.get('X-RateLimit-Limit')).toBe('500')
    })

    it('returns 429 when login POST exceeds auth rate limit', async () => {
      const clientIp = '192.168.99.1'
      const headers = { 'x-forwarded-for': clientIp }

      for (let i = 0; i < 100; i++) {
        const res = await middleware(
          createNextRequest('/login', { method: 'POST', headers })
        )
        expect(res.status).not.toBe(429)
      }

      const blocked = await middleware(
        createNextRequest('/login', { method: 'POST', headers })
      )

      expect(blocked.status).toBe(307)
      expect(blocked.headers.get('location')).toContain('error=rate_limit')
    })
  })

  describe('rate limiting - driven to 429', () => {
    it('returns 429 when the general API rate limit is exceeded', async () => {
      const clientIp = '192.168.100.1'
      const headers = { 'x-forwarded-for': clientIp }

      for (let i = 0; i < 1000; i++) {
        const res = await middleware(
          createNextRequest('/api/content/videos', { headers })
        )
        expect(res.status).not.toBe(429)
      }

      const blocked = await middleware(
        createNextRequest('/api/content/videos', { headers })
      )

      expect(blocked.status).toBe(429)
      const body = await blocked.json()
      expect(body.error).toBe('Rate limit exceeded')
      expect(blocked.headers.get('Retry-After')).toBeTruthy()
    })

    it('returns 429 when the admin API rate limit is exceeded', async () => {
      const clientIp = '192.168.100.2'
      const headers = { 'x-forwarded-for': clientIp }

      for (let i = 0; i < 500; i++) {
        const res = await middleware(
          createNextRequest('/api/admin/users', { headers })
        )
        expect(res.status).not.toBe(429)
      }

      const blocked = await middleware(
        createNextRequest('/api/admin/users', { headers })
      )

      expect(blocked.status).toBe(429)
      const body = await blocked.json()
      expect(body.error).toBe('Rate limit exceeded')
    })
  })

  describe('authentication', () => {
    it('redirects unauthenticated protected pages to login with redirectTo', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({ session: null })
        return client
      })

      const response = await middleware(
        createNextRequest('/dashboard', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(307)
      const location = response.headers.get('location') ?? ''
      expect(location).toContain('/login')
      expect(location).toContain('redirectTo=%2Fdashboard')
    })

    it('redirects to login on session error for page routes', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          sessionError: { message: 'session broken' },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/dashboard', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login?error=session_error')
    })

    it('continues for unauthenticated API routes without redirect', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({ session: null })
        return client
      })

      const response = await middleware(
        createNextRequest('/api/admin/users', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('continues on session error for API routes', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          sessionError: { message: 'session broken' },
        })
        return client
      })

      const token = generateCSRFToken()
      const response = await middleware(
        createNextRequest('/api/content/videos', {
          method: 'POST',
          headers: {
            ...withUniqueIp(),
            'X-CSRF-Token': token,
          },
          cookies: { 'csrf-token': token },
        })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('redirects when profile has no admin_role', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          session: authenticatedSession(),
          profile: {
            admin_role: '',
            full_name: 'No Role',
            last_login_at: new Date().toISOString(),
          },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/dashboard', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login?error=access_denied')
    })
  })

  describe('role-based access', () => {
    it('denies content_admin access to /users', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          session: authenticatedSession(),
          profile: {
            admin_role: 'content_admin',
            full_name: 'Content Admin',
            last_login_at: new Date().toISOString(),
          },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/users', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('error=insufficient_permissions')
    })

    it('denies support_admin access to /analytics', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          session: authenticatedSession(),
          profile: {
            admin_role: 'support_admin',
            full_name: 'Support Admin',
            last_login_at: new Date().toISOString(),
          },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/analytics', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('error=insufficient_permissions')
    })

    it('allows super_admin access to /analytics', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          session: authenticatedSession(),
          profile: {
            admin_role: 'super_admin',
            full_name: 'Super Admin',
            last_login_at: new Date().toISOString(),
          },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/analytics', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('session timeout', () => {
    it('signs out and redirects when last_login_at exceeds 24 hours', async () => {
      const expiredLogin = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      const { client, signOut } = createSupabaseMiddlewareMock({
        session: authenticatedSession(),
        profile: {
          admin_role: 'super_admin',
          full_name: 'Expired Admin',
          last_login_at: expiredLogin,
        },
      })
      mockCreateMiddlewareClient.mockImplementation(() => client)

      const response = await middleware(
        createNextRequest('/dashboard', { headers: withUniqueIp() })
      )

      expect(signOut).toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login?error=session_expired')
    })
  })

  describe('successful authenticated requests', () => {
    it('sets user identity headers for authorized page requests', async () => {
      mockCreateMiddlewareClient.mockImplementation(() => {
        const { client } = createSupabaseMiddlewareMock({
          session: authenticatedSession({ id: 'user-abc', email: 'super@test.com' }),
          profile: {
            admin_role: 'super_admin',
            full_name: 'Super Admin',
            last_login_at: new Date().toISOString(),
          },
        })
        return client
      })

      const response = await middleware(
        createNextRequest('/dashboard', { headers: withUniqueIp() })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('X-User-ID')).toBe('user-abc')
      expect(response.headers.get('X-User-Role')).toBe('super_admin')
      expect(response.headers.get('X-User-Email')).toBe('super@test.com')
    })
  })

  describe('security headers', () => {
    it('applies security headers to all responses', async () => {
      const response = await middleware(
        createNextRequest('/login', { headers: withUniqueIp() })
      )

      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    })
  })
})
