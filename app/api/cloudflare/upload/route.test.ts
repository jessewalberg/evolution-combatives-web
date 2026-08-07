import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'

vi.mock('../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

const mockGetUploadUrl = vi.fn()
const mockCheckUploadStatus = vi.fn()
const mockGenerateAdminPreviewUrl = vi.fn()
const mockGenerateThumbnailUrl = vi.fn()
const mockRetryProcessing = vi.fn()

vi.mock('../../../../src/services/cloudflare-stream', () => ({
  cloudflareStreamService: {
    upload: {
      getUploadUrl: (...args: unknown[]) => mockGetUploadUrl(...args),
      checkUploadStatus: (...args: unknown[]) => mockCheckUploadStatus(...args),
    },
    security: {
      generateAdminPreviewUrl: (...args: unknown[]) => mockGenerateAdminPreviewUrl(...args),
    },
    video: {
      generateThumbnailUrl: (...args: unknown[]) => mockGenerateThumbnailUrl(...args),
      retryProcessing: (...args: unknown[]) => mockRetryProcessing(...args),
    },
  },
}))

import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

const mockAuth = vi.mocked(validateApiAuthWithSession)

function authSuccess() {
  mockAuth.mockResolvedValue({
    user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
  })
}

function authFail() {
  mockAuth.mockResolvedValue({
    error: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
  })
}

describe('POST /api/cloudflare/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth error when unauthorized', async () => {
    authFail()
    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'getUploadUrl' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('handles getUploadUrl', async () => {
    authSuccess()
    mockGetUploadUrl.mockResolvedValue({ uploadURL: 'https://upload', uid: 'cf-1' })

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'getUploadUrl', maxDurationSeconds: 3600 }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: { uploadURL: 'https://upload', uid: 'cf-1' } })
    expect(mockGetUploadUrl).toHaveBeenCalledWith({ maxDurationSeconds: 3600 })
  })

  it('handles checkUploadStatus', async () => {
    authSuccess()
    mockCheckUploadStatus.mockResolvedValue({ status: 'ready', progress: 100 })

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'checkUploadStatus', streamId: 'cf-1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ status: 'ready', progress: 100 })
    expect(mockCheckUploadStatus).toHaveBeenCalledWith('cf-1')
  })

  it('handles generateAdminPreviewUrl', async () => {
    authSuccess()
    mockGenerateAdminPreviewUrl.mockResolvedValue('https://preview')

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'generateAdminPreviewUrl', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(body).toEqual({ success: true, data: { previewUrl: 'https://preview' } })
  })

  it('handles generateThumbnailUrl', async () => {
    authSuccess()
    mockGenerateThumbnailUrl.mockResolvedValue('https://thumb')

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({
          action: 'generateThumbnailUrl',
          videoId: 'v1',
          options: { time: '1s' },
        }),
      })
    )
    const body = await res.json()

    expect(body).toEqual({ success: true, data: { thumbnailUrl: 'https://thumb' } })
    expect(mockGenerateThumbnailUrl).toHaveBeenCalledWith('v1', { time: '1s' })
  })

  it('handles retryProcessing', async () => {
    authSuccess()
    mockRetryProcessing.mockResolvedValue(undefined)

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'retryProcessing', videoId: 'v1' }),
      })
    )
    const body = await res.json()

    expect(body).toEqual({ success: true })
    expect(mockRetryProcessing).toHaveBeenCalledWith('v1')
  })

  it('returns 400 for invalid action', async () => {
    authSuccess()
    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknown' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'Invalid action' })
  })

  it('returns 500 when service throws', async () => {
    authSuccess()
    mockGetUploadUrl.mockRejectedValue(new Error('CF down'))

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'getUploadUrl' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'CF down' })
  })
})
