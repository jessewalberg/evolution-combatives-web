import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './video-signed-url'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

const VALID_VIDEO_ID = '6b9e68b07dfee8cc2d116e4c51d6a957'

const mockSubscriptionSelect = vi.fn()
const mockAdminVideoSelect = vi.fn()
const mockValidateMobileAppAuth = vi.fn()

vi.mock('@/src/lib/mobile-auth', () => ({
  validateMobileAppAuth: (...args: unknown[]) => mockValidateMobileAppAuth(...args),
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'videos') {
        return { select: () => ({ eq: () => ({ single: mockAdminVideoSelect }) }) }
      }
      if (table === 'subscriptions') {
        return { select: () => ({ eq: () => ({ in: () => ({ maybeSingle: mockSubscriptionSelect }) }) }) }
      }
      return { select: () => ({ eq: () => ({ single: vi.fn() }) }) }
    },
  }),
}))

const mockGetVideoDetails = vi.fn()
const mockGenerateSignedUrl = vi.fn()

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
    videoManagement: {
      getVideoDetails: (...args: unknown[]) => mockGetVideoDetails(...args),
      generateSignedUrl: (...args: unknown[]) => mockGenerateSignedUrl(...args),
    },
    CloudflareStreamError,
    isValidStreamVideoId: (id: unknown) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id),
  }
})

function mobileRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return createNextRequest('/api/mobile/video/signed-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer valid-token',
      'X-Mobile-Client': 'EvolutionCombatives',
      'User-Agent': 'EvolutionCombatives-Mobile/1.0',
      ...headers,
    },
  })
}

function makeAuthSuccess() {
  return {
    user: { id: 'user-1', email: 'user@test.com' },
  }
}

function makeAuthError(status: number, errorMsg: string) {
  return {
    error: new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  }
}

describe('POST /api/mobile/video/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateMobileAppAuth.mockResolvedValue(makeAuthSuccess())
    mockSubscriptionSelect.mockResolvedValue({
      data: { tier: 'tier2' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier1', cloudflare_video_id: VALID_VIDEO_ID, title: 'Test Video', is_published: true },
      error: null,
    })
    mockGetVideoDetails.mockResolvedValue({
      status: 'ready',
      duration: 120,
      readyToStream: true,
      thumbnail: 'https://thumb',
    })
    mockGenerateSignedUrl.mockResolvedValue('https://stream.example/video.m3u8?token=abc')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/vnd.apple.mpegurl' },
      })
    )
  })

  it('returns 401 without bearer token', async () => {
    mockValidateMobileAppAuth.mockResolvedValue(makeAuthError(401, 'Bearer token required for mobile API'))

    const res = (await POST(
      createNextRequest('/api/mobile/video/signed-url', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'v1' }),
      })
    ))!
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockValidateMobileAppAuth.mockResolvedValue(makeAuthError(401, 'Invalid authentication token'))

    const res = (await POST(mobileRequest({ videoId: 'v1' })))!
    expect(res.status).toBe(401)
  })

  it('returns 400 when videoId missing', async () => {
    const res = (await POST(mobileRequest({})))!
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Video ID is required')
  })

  it('returns 400 for invalid video ID format before querying database', async () => {
    const res = (await POST(mobileRequest({ videoId: 'not-valid-hex' })))!
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid video ID format')
    expect(mockAdminVideoSelect).not.toHaveBeenCalled()
  })

  it('returns 404 when video not in Cloudflare', async () => {
    const notInCloudflareId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'
    mockGetVideoDetails.mockRejectedValueOnce(new Error('Not Found'))
    mockAdminVideoSelect.mockResolvedValueOnce({
      data: { id: 'vid-1', tier_required: 'tier1', cloudflare_video_id: notInCloudflareId, title: 'Test Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: notInCloudflareId })))!
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Video not found in Cloudflare Stream')
  })

  it('generates signed url using user actual tier', async () => {
    const res = (await POST(
      mobileRequest({ videoId: VALID_VIDEO_ID, format: 'hls' })
    ))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      signed_url: 'https://stream.example/video.m3u8?token=abc',
      video_id: VALID_VIDEO_ID,
      duration: 120,
      thumbnail_url: 'https://thumb',
    })
    // Should use user's actual tier (tier2) not any client-provided value
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      VALID_VIDEO_ID,
      'tier2',
      expect.objectContaining({ downloadable: false }),
      'hls'
    )
  })

  it('returns 403 when user tier insufficient for video', async () => {
    mockSubscriptionSelect.mockResolvedValue({
      data: { tier: 'tier1' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier3', cloudflare_video_id: VALID_VIDEO_ID, title: 'Premium Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Subscription tier too low')
  })

  it('returns 403 for unpublished videos', async () => {
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'none', cloudflare_video_id: VALID_VIDEO_ID, title: 'Draft Video', is_published: false },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Video not available')
  })

  it('treats unknown tier values as none', async () => {
    mockSubscriptionSelect.mockResolvedValue({
      data: { tier: 'legacy_premium' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier1', cloudflare_video_id: VALID_VIDEO_ID, title: 'Test Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Subscription tier too low')
  })

  it('treats missing subscription as none tier', async () => {
    mockSubscriptionSelect.mockResolvedValue({
      data: null,
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier1', cloudflare_video_id: VALID_VIDEO_ID, title: 'Test Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Subscription tier too low')
  })

  it('allows access when no subscription required (tier none)', async () => {
    mockSubscriptionSelect.mockResolvedValue({
      data: null,
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'none', cloudflare_video_id: VALID_VIDEO_ID, title: 'Free Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(200)
  })

  it('treats invalid video tier_required as tier3 (denied, not free)', async () => {
    mockSubscriptionSelect.mockResolvedValue({
      data: { tier: 'tier2' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'garbage_invalid_tier', cloudflare_video_id: VALID_VIDEO_ID, title: 'Corrupted Video', is_published: true },
      error: null,
    })

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Subscription tier too low')
    expect(body.details).toContain('tier3')
  })

  it('supports mp4 format and tolerates HEAD probe failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const res = (await POST(
      mobileRequest({ videoId: VALID_VIDEO_ID, format: 'mp4' })
    ))!
    expect(res.status).toBe(200)
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      VALID_VIDEO_ID,
      'tier2',
      expect.objectContaining({ downloadable: true }),
      'mp4'
    )
  })

  it('returns 404 when generateSignedUrl throws Not Found', async () => {
    mockGetVideoDetails.mockResolvedValueOnce({ status: 'ready', duration: 1, readyToStream: true })
    mockGenerateSignedUrl.mockRejectedValue(new Error('Not Found'))

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Video not found')
  })

  it('returns 500 for generic generation errors', async () => {
    mockGenerateSignedUrl.mockRejectedValue(new Error('signing failed'))

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to generate signed video URL')
  })

  it('returns 500 when auth throws', async () => {
    mockValidateMobileAppAuth.mockResolvedValue(makeAuthError(500, 'Authentication failed'))

    const res = (await POST(mobileRequest({ videoId: VALID_VIDEO_ID })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Authentication failed')
  })
})
