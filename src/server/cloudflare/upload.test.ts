import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { POST as POSTHandler } from './upload'

const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

const mockGetUploadUrl = vi.fn()
const mockCheckUploadStatus = vi.fn()
const mockGenerateAdminPreviewUrl = vi.fn()
const mockGenerateThumbnailUrl = vi.fn()
const mockRetryProcessing = vi.fn()

vi.mock('@/src/services/cloudflare-stream', () => {
  class CloudflareStreamError extends Error {
    code: number
    constructor(message: string, code: number) {
      super(message)
      this.code = code
      this.name = 'CloudflareStreamError'
    }
  }
  return {
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
    CloudflareStreamError,
  }
})

import { validateApiAuthWithSession } from '@/src/lib/api-auth'

const mockAuth = vi.mocked(validateApiAuthWithSession)

describe('POST /api/cloudflare/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth error when unauthorized', async () => {
    authFail(mockAuth, 401)
    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'getUploadUrl' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('handles getUploadUrl', async () => {
    authSuccess(mockAuth)
    mockGetUploadUrl.mockResolvedValue({ uploadURL: 'https://upload', uid: 'cf-1' })

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'getUploadUrl', maxDurationSeconds: 3600 }),
      })
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: { uploadURL: 'https://upload', uid: 'cf-1' } })
    expect(mockGetUploadUrl).toHaveBeenCalledWith({ maxDurationSeconds: 3600 })
  })

  it('handles checkUploadStatus', async () => {
    authSuccess(mockAuth)
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
    authSuccess(mockAuth)
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
    authSuccess(mockAuth)
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
    authSuccess(mockAuth)
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
    authSuccess(mockAuth)
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
    authSuccess(mockAuth)
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

  it('getUploadUrl passes only allowed fields and does not forward requireSignedURLs', async () => {
    authSuccess(mockAuth)
    mockGetUploadUrl.mockResolvedValue({ uploadURL: 'https://upload', uid: 'cf-1' })

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({
          action: 'getUploadUrl',
          maxDurationSeconds: 7200,
          requireSignedURLs: false,
          allowedOrigins: ['https://example.com'],
          thumbnailTimestampPct: 0.5,
          creator: 'admin',
          expiry: '2030-01-01',
          scheduledDeletion: '2030-06-01',
          metadata: { name: 'Test Video' },
          arbitraryField: 'should-be-ignored',
          __proto__: { bad: 'field' },
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockGetUploadUrl).toHaveBeenCalledTimes(1)
    const calledWith = mockGetUploadUrl.mock.calls[0][0]
    expect(calledWith.maxDurationSeconds).toBe(7200)
    expect(calledWith.allowedOrigins).toEqual(['https://example.com'])
    expect(calledWith.thumbnailTimestampPct).toBe(0.5)
    expect(calledWith.creator).toBe('admin')
    expect(calledWith.expiry).toBe('2030-01-01')
    expect(calledWith.scheduledDeletion).toBe('2030-06-01')
    expect(calledWith.metadata).toEqual({ name: 'Test Video' })
    expect(calledWith.requireSignedURLs).toBeUndefined()
    expect(calledWith.arbitraryField).toBeUndefined()
  })

  it('returns 400 for invalid video ID format in checkUploadStatus', async () => {
    authSuccess(mockAuth)
    const { CloudflareStreamError } = await import('@/src/services/cloudflare-stream')
    mockCheckUploadStatus.mockRejectedValue(
      new CloudflareStreamError('Invalid video ID format', 400)
    )

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'checkUploadStatus', streamId: 'invalid' }),
      })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid video ID format')
  })

  it('returns 400 for invalid video ID format in generateAdminPreviewUrl', async () => {
    authSuccess(mockAuth)
    const { CloudflareStreamError } = await import('@/src/services/cloudflare-stream')
    mockGenerateAdminPreviewUrl.mockRejectedValue(
      new CloudflareStreamError('Invalid video ID format', 400)
    )

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'generateAdminPreviewUrl', videoId: 'bad-id' }),
      })
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid video ID format in retryProcessing', async () => {
    authSuccess(mockAuth)
    const { CloudflareStreamError } = await import('@/src/services/cloudflare-stream')
    mockRetryProcessing.mockRejectedValue(
      new CloudflareStreamError('Invalid video ID format', 400)
    )

    const res = await POST(
      createNextRequest('/api/cloudflare/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'retryProcessing', videoId: 'xyz' }),
      })
    )

    expect(res.status).toBe(400)
  })
})
