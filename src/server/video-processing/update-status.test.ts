import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './update-status'

const POST = (request?: Request) =>
  POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

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

function buildSupabase(options: {
  videos?: Array<{ id: string; title: string; processing_status: string }>
  findError?: boolean
  updateError?: boolean
}) {
  const selectEq = vi.fn().mockResolvedValue({
    data: options.videos ?? [],
    error: options.findError ? { message: 'db error' } : null,
  })
  const updateSingle = vi.fn().mockResolvedValue({
    data: { id: 'v1', processing_status: 'ready' },
    error: options.updateError ? { message: 'update failed' } : null,
  })

  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({ eq: selectEq }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSingle }),
        }),
      }),
    })),
  }
}

describe('POST /api/video-processing/update-status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires content.write auth (current behavior)', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
    })

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({
          cloudflareVideoId: 'cf-1',
          updateData: { processing_status: 'ready' },
        }),
      })
    )

    expect(res.status).toBe(401)
    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('returns 400 when cloudflareVideoId is missing', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({ updateData: { processing_status: 'ready' } }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'Missing cloudflareVideoId' })
  })

  it('returns 404 when video not found', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockReturnValue(buildSupabase({ videos: [] }) as never)

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({
          cloudflareVideoId: 'cf-missing',
          updateData: { processing_status: 'ready' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ success: false, error: 'Video not found' })
  })

  it('updates video status on success', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({
        videos: [{ id: 'v1', title: 'Test', processing_status: 'processing' }],
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({
          cloudflareVideoId: 'cf-1',
          updateData: { processing_status: 'ready' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.video).toEqual({ id: 'v1', processing_status: 'ready' })
  })

  it('returns 500 when find query errors', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockReturnValue(buildSupabase({ findError: true }) as never)

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({
          cloudflareVideoId: 'cf-1',
          updateData: { processing_status: 'ready' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to find video')
  })

  it('returns 500 when update query errors', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({
        videos: [{ id: 'v1', title: 'Test', processing_status: 'processing' }],
        updateError: true,
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: JSON.stringify({
          cloudflareVideoId: 'cf-1',
          updateData: { processing_status: 'ready' },
        }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to update video status')
  })

  it('returns 500 when request.json throws', async () => {
    mockAuth.mockResolvedValue({
      user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
    })

    const res = await POST(
      createNextRequest('/api/video-processing/update-status', {
        method: 'POST',
        body: 'not-json',
        headers: { 'content-type': 'application/json' },
      })
    )
    expect(res.status).toBe(500)
  })
})
