import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
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

describe('POST /api/video-processing/sync-all', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'denied' }, { status: 401 }),
    })

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 500 when fetch fails', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
          }),
        }),
      })),
    } as never)

    const res = await POST()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to fetch processing videos')
  })

  it('syncs ready and error videos and skips missing cloudflare ids', async () => {
    authSuccess()
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'v1', cloudflare_video_id: null, title: 'No CF', processing_status: 'processing' },
                {
                  id: 'v2',
                  cloudflare_video_id: 'cf-ready',
                  title: 'Ready',
                  processing_status: 'processing',
                },
                {
                  id: 'v3',
                  cloudflare_video_id: 'cf-error',
                  title: 'Error',
                  processing_status: 'processing',
                },
                {
                  id: 'v4',
                  cloudflare_video_id: 'cf-pending',
                  title: 'Pending',
                  processing_status: 'processing',
                },
                {
                  id: 'v5',
                  cloudflare_video_id: 'cf-throw',
                  title: 'Throw',
                  processing_status: 'processing',
                },
              ],
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: updateEq }),
      })),
    } as never)

    mockCheckUploadStatus
      .mockResolvedValueOnce({ status: 'ready' })
      .mockResolvedValueOnce({ status: 'error' })
      .mockResolvedValueOnce({ status: 'processing' })
      .mockRejectedValueOnce(new Error('CF fail'))

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.results.checked).toBe(4)
    expect(body.results.updated).toBe(2)
    expect(body.results.errors).toBeGreaterThanOrEqual(2)
  })

  it('records update failures', async () => {
    authSuccess()
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'v1',
                  cloudflare_video_id: 'cf-1',
                  title: 'Vid',
                  processing_status: 'processing',
                },
              ],
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'update fail' } }),
        }),
      })),
    } as never)
    mockCheckUploadStatus.mockResolvedValue({ status: 'ready' })

    const res = await POST()
    const body = await res.json()

    expect(body.results.errors).toBe(1)
    expect(body.results.details[0].error).toContain('Failed to update')
  })

  it('returns 500 on unexpected throw', async () => {
    authSuccess()
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error('boom')
    })

    const res = await POST()
    expect(res.status).toBe(500)
  })
})
