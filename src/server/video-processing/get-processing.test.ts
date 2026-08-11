import { describe, it, expect, vi, beforeEach } from 'vitest'
import { json as jsonResponse } from '@/src/lib/http'
import { GET } from './get-processing'

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

describe('GET /api/video-processing/get-processing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    mockAuth.mockResolvedValue({
      error: jsonResponse({ success: false, error: 'denied' }, { status: 401 }),
    })

    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockAuth).toHaveBeenCalledWith('content.read')
  })

  it('returns processing videos', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    const videos = [{ id: 'v1', processing_status: 'processing', title: 'A' }]
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: videos, error: null }),
          }),
        }),
      })),
    } as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, processingVideos: videos })
  })

  it('returns 500 when query errors', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
          }),
        }),
      })),
    } as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to fetch processing videos')
  })

  it('returns 500 when client throws', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('client boom')
    })

    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('client boom')
  })
})
