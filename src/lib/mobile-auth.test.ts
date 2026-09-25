import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'

const mockGetUser = vi.fn()
const mockCreateClient = vi.fn((..._args: unknown[]) => ({ auth: { getUser: mockGetUser } }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { authenticateMobileBearer } from './mobile-auth'

describe('authenticateMobileBearer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    })
  })

  it('requires an exact bearer authorization header', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer ', 'Bearer abc extra']) {
      const request = createNextRequest('/api/mobile/test', {
        headers: authorization ? { Authorization: authorization } : undefined,
      })
      const result = await authenticateMobileBearer(request)
      expect('error' in result).toBe(true)
      if ('error' in result) expect(result.error.status).toBe(401)
    }
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('fails safely when Supabase public configuration is absent', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const result = await authenticateMobileBearer(
      createNextRequest('/api/mobile/test', {
        headers: { Authorization: 'Bearer token-1' },
      })
    )
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error.status).toBe(500)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('verifies the token and returns an RLS-scoped client', async () => {
    const result = await authenticateMobileBearer(
      createNextRequest('/api/mobile/test', {
        headers: { Authorization: 'Bearer token-1' },
      })
    )

    expect(result).toMatchObject({ data: { user: { id: 'user-1' } } })
    expect(mockGetUser).toHaveBeenCalledWith('token-1')
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: 'Bearer token-1' } },
      }
    )
  })

  it('returns 401 for a rejected token without exposing provider details', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'internal auth provider detail' },
    })
    const result = await authenticateMobileBearer(
      createNextRequest('/api/mobile/test', {
        headers: { Authorization: 'Bearer bad-token' },
      })
    )

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(401)
      expect((await result.error.json()).error).toBe('Invalid authentication token')
    }
  })

  it('returns a generic 500 if token verification crashes', async () => {
    mockGetUser.mockRejectedValue(new Error('private provider error'))
    const result = await authenticateMobileBearer(
      createNextRequest('/api/mobile/test', {
        headers: { Authorization: 'Bearer token-1' },
      })
    )

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(500)
      expect((await result.error.json()).error).toBe('Authentication failed')
    }
  })
})
