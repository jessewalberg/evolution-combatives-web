import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { POST } from './route'

vi.mock('../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function headSelect(count: number) {
  // head:true count queries may still chain .eq() for filters
  const result = Promise.resolve({ count, error: null })
  return Object.assign(result, {
    eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
  })
}

function buildSupabase() {
  const defaultFrom = vi.fn((table: string) => {
    if (table === 'disciplines' || table === 'categories') {
      return {
        select: vi.fn(() => headSelect(5)),
      }
    }
    if (table === 'videos') {
      return {
        select: vi.fn(() => headSelect(10)),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'v-new', title: 'New' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'v1', title: 'Updated' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    if (table === 'user_progress') {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    return {}
  })

  return { from: defaultFrom }
}

describe('POST /api/admin/content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)
  })

  it('returns 401 when auth fails', async () => {
    authFail(mockAuth, 401)
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'fetchContentStats' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('handles fetchContentStats', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'fetchContentStats' }),
      })
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      totalDisciplines: 5,
      totalCategories: 5,
      totalVideos: 10,
      publishedVideos: 3,
      processingVideos: 3,
    })
  })

  it('handles createVideo', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'createVideo',
          videoData: { title: 'New', slug: 'new' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ id: 'v-new', title: 'New' })
  })

  it('handles updateVideo', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateVideo',
          videoId: 'v1',
          updates: { title: 'Updated' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ id: 'v1', title: 'Updated' })
  })

  it('handles deleteVideo', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteVideo', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
  })

  it('returns 400 for invalid action', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknownAction' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'Invalid action' })
  })

  it('handles bulkUpdateVideoStatus with mixed results', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    let call = 0
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            call++
            if (call === 1) return Promise.resolve({ error: null })
            if (call === 2) return Promise.resolve({ error: { message: 'fail' } })
            return Promise.reject(new Error('boom'))
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulkUpdateVideoStatus',
          videoIds: ['v1', 'v2', 'v3'],
          updates: { is_published: true },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.processed).toBe(1)
    expect(body.data.failed).toBe(2)
    expect(body.data.success).toBe(false)
  })

  it('handles bulkDeleteVideos', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulkDeleteVideos',
          videoIds: ['v1', 'v2'],
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({ success: true, processed: 2, failed: 0 })
  })

  it('handles bulkDeleteVideos failure path', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'fk' } }),
          }),
        }
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'bulkDeleteVideos', videoIds: ['v1'] }),
      })
    )
    const body = await res.json()

    expect(body.data.failed).toBe(1)
    expect(body.data.success).toBe(false)
  })

  it('handles getVideoAnalytics', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                title: 'Vid',
                view_count: 100,
                user_progress: [
                  { progress_percentage: 100, completed: true, user_id: 'u1' },
                  { progress_percentage: 50, completed: false, user_id: 'u2' },
                ],
              },
              error: null,
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'getVideoAnalytics', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      videoId: 'v1',
      title: 'Vid',
      viewCount: 100,
      completionRate: 50,
      averageWatchTime: 75,
    })
  })

  it('returns 500 when createVideo fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'insert fail', code: '23505' },
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'createVideo', videoData: { title: 'x' } }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })

  it('returns 500 when deleteVideo progress cleanup fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'progress fail' } }),
            }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteVideo', videoId: 'v1' }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('Failed to cleanup user progress')
  })

  it('returns 500 when updateVideo fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'update fail', code: 'PGRST116' },
              }),
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateVideo',
          videoId: 'v1',
          updates: { title: 'Nope' },
        }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })

  it('returns 500 when deleteVideo video delete fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'video delete fail' } }),
          }),
        }
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteVideo', videoId: 'v1' }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })

  it('returns 500 when getVideoAnalytics fetch fails', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'getVideoAnalytics', videoId: 'missing' }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })

  it('handles getVideoAnalytics with empty progress', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                title: 'Empty',
                view_count: 0,
                user_progress: [],
              },
              error: null,
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'getVideoAnalytics', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      completionRate: 0,
      averageWatchTime: 0,
      viewCount: 0,
    })
  })

  it('handles getVideoAnalytics when user_progress is null', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                title: 'Null progress',
                view_count: 5,
                user_progress: null,
              },
              error: null,
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({ action: 'getVideoAnalytics', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.completionRate).toBe(0)
    expect(body.data.averageWatchTime).toBe(0)
  })

  it('handles bulkDeleteVideos catch path when delete throws', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockRejectedValue(new Error('progress boom')),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulkDeleteVideos',
          videoIds: ['v1'],
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.failed).toBe(1)
    expect(body.data.success).toBe(false)
    expect(body.data.errors[0]).toContain('progress boom')
  })

  it('handles bulkUpdateVideoStatus all success', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulkUpdateVideoStatus',
          videoIds: ['v1', 'v2'],
          updates: { is_published: false },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({
      success: true,
      processed: 2,
      failed: 0,
    })
  })

  it('returns 500 when request body is invalid JSON', async () => {
    authSuccess(mockAuth, { role: 'super_admin' })
    const res = await POST(
      createNextRequest('/api/admin/content', {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).success).toBe(false)
  })
})
