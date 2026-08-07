import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST, GET, PUT, DELETE, PATCH } from './route'

vi.mock('../../../../src/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '../../../../src/lib/supabase'

const mockCreateServerClient = vi.mocked(createServerClient)

function buildAuthClient(options: {
  authError?: { message: string } | null
  user?: { id: string; email: string } | null
  profile?: { admin_role: string | null; full_name: string; last_login_at: string | null } | null
  profileError?: boolean
}) {
  const signInWithPassword = vi.fn().mockResolvedValue({
    data: { user: options.user ?? null },
    error: options.authError ?? null,
  })
  const signOut = vi.fn().mockResolvedValue({ error: null })
  const profileSingle = vi.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: options.profileError ? { message: 'not found' } : null,
  })
  const updateEq = vi.fn().mockResolvedValue({ error: null })

  return {
    auth: { signInWithPassword, signOut },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: profileSingle }),
      }),
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    })),
    _mocks: { signInWithPassword, signOut, profileSingle, updateEq },
  }
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid request body', async () => {
    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'bad', password: 'short' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Validation error')
  })

  it('returns 401 when credentials are invalid', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildAuthClient({
        authError: { message: 'Invalid login credentials' },
        user: null,
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication failed')
    expect(body.message).toContain('Invalid email or password')
  })

  it('returns email-not-confirmed message when applicable', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildAuthClient({
        authError: { message: 'Email not confirmed' },
        user: null,
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.2' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.message).toContain('confirmation link')
  })

  it('returns 403 when profile is missing', async () => {
    const client = buildAuthClient({
      user: { id: 'u1', email: 'admin@test.com' },
      profile: null,
      profileError: true,
    })
    mockCreateServerClient.mockResolvedValue(client as never)

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Profile verification failed')
    expect(client._mocks.signOut).toHaveBeenCalled()
  })

  it('returns 403 when user has no admin role', async () => {
    const client = buildAuthClient({
      user: { id: 'u1', email: 'user@test.com' },
      profile: { admin_role: null, full_name: 'User', last_login_at: null },
    })
    mockCreateServerClient.mockResolvedValue(client as never)

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@test.com', password: 'password123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Access denied')
    expect(client._mocks.signOut).toHaveBeenCalled()
  })

  it('returns success for valid admin login', async () => {
    const client = buildAuthClient({
      user: { id: 'u1', email: 'admin@test.com' },
      profile: { admin_role: 'super_admin', full_name: 'Admin', last_login_at: null },
    })
    mockCreateServerClient.mockResolvedValue(client as never)

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
        body: JSON.stringify({
          email: 'Admin@test.com',
          password: 'password123',
          rememberMe: true,
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      message: 'Login successful',
      user: {
        id: 'u1',
        email: 'admin@test.com',
        role: 'super_admin',
        name: 'Admin',
      },
    })
    expect(client._mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@test.com',
      password: 'password123',
    })
  })

  it('returns 500 on unexpected errors', async () => {
    mockCreateServerClient.mockRejectedValue(new Error('boom'))

    const res = await POST(
      createNextRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal server error')
  })
})

describe('method guards /api/auth/login', () => {
  it('GET returns 405', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    expect((await res.json()).error).toBe('Method not allowed')
  })

  it('PUT/DELETE/PATCH return 405', async () => {
    expect((await PUT()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
    expect((await PATCH()).status).toBe(405)
  })
})
