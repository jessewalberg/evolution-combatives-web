import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'

vi.mock('../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

const mockCheckUploadStatus = vi.fn()

vi.mock('../../../../src/services/cloudflare-stream', () => ({
  cloudflareStreamService: {
    upload: {
      checkUploadStatus: (...args: unknown[]) => mockCheckUploadStatus(...args),
    },
  },
}))

import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function authSuccess() {
  mockAuth.mockResolvedValue({
    user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
  })
}

function request(body: Record<string, unknown>) {
  return createNextRequest('/api/video-processing/sync-single', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/video-processing/sync-single', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'denied' }, { status: 401 }),
    })

    const res = await POST(request({ videoId: 'v1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when videoId missing', async () => {
    authSuccess()
    const res = await POST(request({}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Video ID is required')
  })

  it('returns 404 when video not found', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
          }),
        }),
      })),
    } as never)

    const res = await POST(request({ videoId: 'missing' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when cloudflare id missing', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: null,
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
      })),
    } as never)

    const res = await POST(request({ videoId: 'v1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('No Cloudflare video ID')
  })

  it('updates video when cloudflare status is ready', async () => {
    authSuccess()
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: 'cf-1',
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: updateEq }),
      })),
    } as never)
    mockCheckUploadStatus.mockResolvedValue({ status: 'ready' })

    const res = await POST(request({ videoId: 'v1' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.result.updated).toBe(true)
    expect(body.result.newStatus).toBe('ready')
  })

  it('updates video when cloudflare status is error', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: 'cf-1',
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    } as never)
    mockCheckUploadStatus.mockResolvedValue({ status: 'error' })

    const res = await POST(request({ videoId: 'v1' }))
    const body = await res.json()

    expect(body.result.newStatus).toBe('error')
    expect(body.result.updated).toBe(true)
  })

  it('does not update when still processing', async () => {
    authSuccess()
    const update = vi.fn()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: 'cf-1',
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
        update,
      })),
    } as never)
    mockCheckUploadStatus.mockResolvedValue({ status: 'processing' })

    const res = await POST(request({ videoId: 'v1' }))
    const body = await res.json()

    expect(body.result.updated).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('returns 500 when update fails', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: 'cf-1',
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'lock' } }),
        }),
      })),
    } as never)
    mockCheckUploadStatus.mockResolvedValue({ status: 'ready' })

    const res = await POST(request({ videoId: 'v1' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('Failed to update video')
  })

  it('returns 500 when cloudflare throws', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                cloudflare_video_id: 'cf-1',
                title: 'Vid',
                processing_status: 'processing',
              },
              error: null,
            }),
          }),
        }),
      })),
    } as never)
    mockCheckUploadStatus.mockRejectedValue(new Error('CF down'))

    const res = await POST(request({ videoId: 'v1' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('CF down')
  })
})
