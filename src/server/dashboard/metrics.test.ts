import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './metrics'
import { authSuccess, authFail } from '@/test/helpers/auth'

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { createAdminClient } from '@/src/lib/supabase'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function buildSupabase(options?: {
  usersError?: boolean
  subscriptionsError?: boolean
  videosError?: boolean
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: options?.usersError
                ? null
                : [
                    { id: 'u1', created_at: daysAgo(5) },
                    { id: 'u2', created_at: daysAgo(40) },
                    { id: 'u3', created_at: daysAgo(70) },
                  ],
              error: options?.usersError ? { message: 'users fail' } : null,
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: options?.subscriptionsError
                ? null
                : [
                    { id: 's1', tier: 'tier1', status: 'active' },
                    { id: 's2', tier: 'advanced', status: 'active' },
                    { id: 's3', tier: 'unknown', status: 'active' },
                  ],
              error: options?.subscriptionsError ? { message: 'subs fail' } : null,
            }),
          }),
        }
      }
      if (table === 'videos') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: options?.videosError
                ? null
                : [
                    { id: 'v1', created_at: daysAgo(2), processing_status: 'ready', view_count: 10 },
                    {
                      id: 'v2',
                      created_at: daysAgo(40),
                      processing_status: 'processing',
                      view_count: 0,
                    },
                    {
                      id: 'v3',
                      created_at: daysAgo(1),
                      processing_status: 'uploading',
                      view_count: 0,
                    },
                  ],
              error: options?.videosError ? { message: 'videos fail' } : null,
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('GET /api/dashboard/metrics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns computed metrics', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)

    const res = await GET()
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('analytics.read')
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      totalUsers: 3,
      activeSubscriptions: 3,
      monthlyRevenue: 58, // 9 + 49 + 0
      totalVideos: 3,
      processingVideos: 2,
      pendingQA: 5,
      systemAlerts: 2,
    })
    expect(body.data.totalUsersGrowth).toBeTypeOf('number')
  })

  it('returns 500 when users query fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue(buildSupabase({ usersError: true }) as never)

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 500 when subscriptions query fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue(buildSupabase({ subscriptionsError: true }) as never)

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 500 when videos query fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue(buildSupabase({ videosError: true }) as never)

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
