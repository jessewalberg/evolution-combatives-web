import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  extractUserFromRequest,
  hasPermission,
  validateApiAuth,
  validateApiAuthWithSession,
  ROLE_PERMISSIONS,
} from '@/src/lib/api-auth'
import { createAuthenticatedRequest, createNextRequest } from '@/test/helpers/next-request'

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

describe('extractUserFromRequest', () => {
  it('returns null when any required header is missing', () => {
    expect(extractUserFromRequest(createNextRequest('/api/x'))).toBeNull()
    expect(
      extractUserFromRequest(
        createNextRequest('/api/x', {
          headers: { 'X-User-ID': '1', 'X-User-Role': 'super_admin' },
        })
      )
    ).toBeNull()
  })

  it('extracts user from headers', () => {
    const req = createAuthenticatedRequest('/api/x', {
      userId: 'u1',
      role: 'content_admin',
      email: 'a@b.com',
    })
    expect(extractUserFromRequest(req)).toEqual({
      userId: 'u1',
      role: 'content_admin',
      email: 'a@b.com',
    })
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
  it('returns 401 when unauthenticated', async () => {
    const result = validateApiAuth(createNextRequest('/api/x'), 'content.read')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(401)
      const body = await result.error.json()
      expect(body.error).toBe('Authentication required')
    }
  })

  it('returns 403 when permission missing', async () => {
    const req = createAuthenticatedRequest('/api/x', {
      userId: 'u1',
      role: 'support_admin',
      email: 's@test.com',
    })
    const result = validateApiAuth(req, 'content.write')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(403)
    }
  })

  it('returns user when authorized', () => {
    const req = createAuthenticatedRequest('/api/x', {
      userId: 'u1',
      role: 'content_admin',
      email: 'c@test.com',
    })
    const result = validateApiAuth(req, 'content.write')
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

describe('NextRequest fixture typing', () => {
  it('uses real NextRequest instances', () => {
    const req = createNextRequest('/api/test', { method: 'POST' })
    expect(req).toBeInstanceOf(NextRequest)
    expect(req.method).toBe('POST')
  })
})
