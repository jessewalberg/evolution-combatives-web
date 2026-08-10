import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasPermission,
  validateApiAuth,
  validateApiAuthWithSession,
  ROLE_PERMISSIONS,
} from '@/src/lib/api-auth'

vi.mock('@/src/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/src/lib/supabase'

const mockedCreateServerClient = vi.mocked(createServerClient)

describe('ROLE_PERMISSIONS', () => {
  it('gives super_admin admin.all and broad permissions', () => {
    expect(ROLE_PERMISSIONS.super_admin.has('admin.all')).toBe(true)
    expect(ROLE_PERMISSIONS.super_admin.has('users.delete')).toBe(true)
  })

  it('scopes content_admin and support_admin', () => {
    expect(ROLE_PERMISSIONS.content_admin.has('content.write')).toBe(true)
    expect(ROLE_PERMISSIONS.content_admin.has('users.write')).toBe(false)
    expect(ROLE_PERMISSIONS.support_admin.has('support.write')).toBe(true)
    expect(ROLE_PERMISSIONS.support_admin.has('content.write')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('grants via admin.all or exact permission', () => {
    expect(hasPermission('super_admin', 'anything')).toBe(true)
    expect(hasPermission('content_admin', 'content.read')).toBe(true)
    expect(hasPermission('content_admin', 'users.delete')).toBe(false)
    expect(hasPermission('unknown', 'content.read')).toBe(false)
  })
})

describe('validateApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated (delegates to session validation)', async () => {
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no' } }),
      },
      from: vi.fn(),
    } as never)

    const result = await validateApiAuth(new Request('http://localhost/api/x'), 'content.read')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(401)
      const body = await result.error.json()
      expect(body.error).toBe('Authentication required')
    }
  })

  it('returns user when session and permission ok', async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { admin_role: 'content_admin' }, error: null }),
        }),
      }),
    })
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'c@test.com' } },
          error: null,
        }),
      },
      from,
    } as never)

    const result = await validateApiAuth(new Request('http://localhost/api/x'), 'content.write')
    expect(result).toEqual({
      user: { userId: 'u1', role: 'content_admin', email: 'c@test.com' },
    })
  })
})

describe('validateApiAuthWithSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when getUser fails', async () => {
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no' } }),
      },
      from: vi.fn(),
    } as never)

    const result = await validateApiAuthWithSession('content.read')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(401)
    }
  })

  it('returns 403 when profile has no admin_role', async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { admin_role: null }, error: null }),
        }),
      }),
    })
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'a@b.com' } },
          error: null,
        }),
      },
      from,
    } as never)

    const result = await validateApiAuthWithSession('content.read')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(403)
      const body = await result.error.json()
      expect(body.error).toBe('Admin role required')
    }
  })

  it('returns 403 when role lacks permission', async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { admin_role: 'support_admin' },
            error: null,
          }),
        }),
      }),
    })
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'a@b.com' } },
          error: null,
        }),
      },
      from,
    } as never)

    const result = await validateApiAuthWithSession('content.write')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(403)
      const body = await result.error.json()
      expect(body.error).toBe('Insufficient permissions')
    }
  })

  it('returns user when session and permission ok', async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { admin_role: 'super_admin' },
            error: null,
          }),
        }),
      }),
    })
    mockedCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'admin@test.com' } },
          error: null,
        }),
      },
      from,
    } as never)

    const result = await validateApiAuthWithSession('content.write')
    expect(result).toEqual({
      user: { userId: 'u1', role: 'super_admin', email: 'admin@test.com' },
    })
  })

  it('returns 500 when createServerClient throws', async () => {
    mockedCreateServerClient.mockRejectedValue(new Error('boom'))
    const result = await validateApiAuthWithSession('content.read')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(500)
    }
  })
})
