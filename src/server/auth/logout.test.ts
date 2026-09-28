import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './logout'

vi.mock('@/src/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/src/lib/supabase'

const mockCreateServerClient = vi.mocked(createServerClient)

const deleteCookie = vi.fn()
vi.mock('@tanstack/react-start/server', () => ({
  deleteCookie: (...args: unknown[]) => (deleteCookie as (...a: unknown[]) => unknown)(...args),
}))

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logs out successfully when session exists', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'u1' } } },
        }),
        signOut,
      },
    } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, message: 'Logged out successfully' })
    expect(signOut).toHaveBeenCalled()
    expect(deleteCookie).toHaveBeenCalledWith('sb-access-token')
    expect(deleteCookie).toHaveBeenCalledWith('sb-refresh-token')
  })

  it('logs out successfully when no session', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    } as never)

    const res = await POST()
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 500 when signOut fails', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signOut: vi.fn().mockResolvedValue({ error: { message: 'sign out failed' } }),
      },
    } as never)

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({
      success: false,
      error: 'Logout failed',
      message: 'sign out failed',
    })
  })

  it('returns 500 on unexpected errors', async () => {
    mockCreateServerClient.mockRejectedValue(new Error('client fail'))

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Internal server error')
  })
})

describe('GET /api/auth/logout', () => {
  it('returns 405', async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    expect((await res.json()).error).toBe('Method not allowed')
  })
})
