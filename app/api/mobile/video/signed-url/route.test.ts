import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

const mockAuthenticateMobileBearer = vi.fn()
vi.mock('../../../../../src/lib/mobile-auth', () => ({
  authenticateMobileBearer: (...args: unknown[]) => mockAuthenticateMobileBearer(...args),
}))

const mockGetVideoDetails = vi.fn()
const mockGenerateSignedUrl = vi.fn()
const mockUpdateVideoSettings = vi.fn()
vi.mock('../../../../../src/services/cloudflare-stream', () => ({
  videoManagement: {
    getVideoDetails: (...args: unknown[]) => mockGetVideoDetails(...args),
    generateSignedUrl: (...args: unknown[]) => mockGenerateSignedUrl(...args),
    updateVideoSettings: (...args: unknown[]) => mockUpdateVideoSettings(...args),
  },
}))

import { POST } from './route'

const APP_VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const fakeSupabase = createFakeSupabaseClient()

const publishedVideo = {
  id: APP_VIDEO_ID,
  cloudflare_video_id: 'cloudflare-uid-1',
  duration_seconds: 115,
  thumbnail_url: 'https://images.example/db.jpg',
  tier_required: 'tier1',
  processing_status: 'ready',
  is_published: true,
}

const activeSubscription = {
  tier: 'tier2',
  status: 'active',
  current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
  created_at: new Date().toISOString(),
}

function mobileRequest(body: Record<string, unknown>) {
  return createNextRequest('/api/mobile/video/signed-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer valid-token' },
  })
}

function queueAccess(
  video: Record<string, unknown> | null = publishedVideo,
  subscription: Record<string, unknown> | null = activeSubscription
) {
  fakeSupabase.queueResult({ data: video, error: null })
  fakeSupabase.queueResult({ data: subscription, error: null })
}

describe('POST /api/mobile/video/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeSupabase.reset()
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'test-key-id'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'test-private-key'
    mockAuthenticateMobileBearer.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        supabase: fakeSupabase,
      },
    })
    mockGetVideoDetails.mockResolvedValue({
      status: { state: 'ready' },
      duration: 120,
      readyToStream: true,
      requireSignedURLs: true,
      thumbnail: 'https://images.example/cloudflare.jpg',
    })
    mockUpdateVideoSettings.mockResolvedValue(undefined)
    mockGenerateSignedUrl.mockResolvedValue(
      'https://stream.example/cloudflare-uid-1/manifest/video.m3u8?token=secure'
    )
  })

  afterEach(() => {
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  })

  it('returns the reusable bearer helper error', async () => {
    mockAuthenticateMobileBearer.mockResolvedValue({
      error: Response.json({ success: false, error: 'Bearer token required' }, { status: 401 }),
    })

    const response = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(response.status).toBe(401)
    expect(fakeSupabase.from).not.toHaveBeenCalled()
  })

  it('requires an application UUID and rejects caller-supplied entitlement fields', async () => {
    const invalidId = await POST(mobileRequest({ videoId: 'cloudflare-uid-1' }))
    expect(invalidId.status).toBe(400)

    const forgedTier = await POST(
      mobileRequest({ videoId: APP_VIDEO_ID, subscriptionTier: 'tier3' })
    )
    expect(forgedTier.status).toBe(400)
    expect(fakeSupabase.from).not.toHaveBeenCalled()
  })

  it('returns 404 for missing or unpublished content', async () => {
    fakeSupabase.queueResult({ data: null, error: null })
    const missing = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(missing.status).toBe(404)

    fakeSupabase.reset()
    fakeSupabase.queueResult({ data: { ...publishedVideo, is_published: false }, error: null })
    const unpublished = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(unpublished.status).toBe(404)
  })

  it('rejects a video that is not ready in the application database', async () => {
    fakeSupabase.queueResult({
      data: { ...publishedVideo, processing_status: 'processing' },
      error: null,
    })

    const response = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(response.status).toBe(409)
    expect(mockGetVideoDetails).not.toHaveBeenCalled()
  })

  it('fails closed when video or entitlement lookups fail', async () => {
    fakeSupabase.queueResult({ data: null, error: { message: 'video db down' } })
    const videoFailure = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(videoFailure.status).toBe(500)

    fakeSupabase.reset()
    fakeSupabase.queueResult({ data: publishedVideo, error: null })
    fakeSupabase.queueResult({ data: null, error: { message: 'subscription db down' } })
    const subscriptionFailure = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(subscriptionFailure.status).toBe(500)
  })

  it('denies paid content without a current active or trialing entitlement', async () => {
    queueAccess(publishedVideo, null)
    const missing = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(missing.status).toBe(403)

    fakeSupabase.reset()
    queueAccess(publishedVideo, {
      ...activeSubscription,
      tier: 'tier3',
      current_period_end: new Date(Date.now() - 1_000).toISOString(),
    })
    const expired = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(expired.status).toBe(403)
  })

  it('enforces tier hierarchy and reserves MP4 downloads for tier 2+', async () => {
    queueAccess({ ...publishedVideo, tier_required: 'tier3' }, activeSubscription)
    const belowTier = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(belowTier.status).toBe(403)

    fakeSupabase.reset()
    queueAccess({ ...publishedVideo, tier_required: 'none' }, { ...activeSubscription, tier: 'tier1' })
    const mp4 = await POST(mobileRequest({ videoId: APP_VIDEO_ID, format: 'mp4' }))
    expect(mp4.status).toBe(403)
  })

  it('fails closed when signing keys are absent', async () => {
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    queueAccess()

    const response = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(response.status).toBe(503)
    expect(mockGetVideoDetails).not.toHaveBeenCalled()
  })

  it('rejects Cloudflare content that is not ready', async () => {
    queueAccess()
    mockGetVideoDetails.mockResolvedValue({
      status: { state: 'inprogress' },
      readyToStream: false,
      requireSignedURLs: true,
    })

    const response = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(response.status).toBe(409)
    expect(mockGenerateSignedUrl).not.toHaveBeenCalled()
  })

  it('enables signed URLs before generating playback when necessary', async () => {
    queueAccess()
    mockGetVideoDetails.mockResolvedValue({
      status: { state: 'ready' },
      readyToStream: true,
      requireSignedURLs: false,
    })

    const response = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(response.status).toBe(200)
    expect(mockUpdateVideoSettings).toHaveBeenCalledWith('cloudflare-uid-1', {
      requireSignedURLs: true,
    })
  })

  it('resolves the Cloudflare ID and subscription tier server-side', async () => {
    queueAccess()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

    const response = await POST(
      mobileRequest({ videoId: APP_VIDEO_ID, format: 'hls' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      video_id: APP_VIDEO_ID,
      signed_url: expect.stringContaining('token=secure'),
      duration: 120,
      thumbnail_url: 'https://images.example/cloudflare.jpg',
      expires_at: new Date((1_700_000_000 + 8 * 60 * 60) * 1000).toISOString(),
    })
    expect(mockGetVideoDetails).toHaveBeenCalledWith('cloudflare-uid-1')
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      'cloudflare-uid-1',
      'tier2',
      { downloadable: false, exp: 1_700_000_000 + 8 * 60 * 60 },
      'hls'
    )
    now.mockRestore()
  })

  it('never returns an unsigned URL and masks provider failures', async () => {
    queueAccess()
    mockGenerateSignedUrl.mockResolvedValue('https://stream.example/public.m3u8')
    const unsigned = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(unsigned.status).toBe(502)

    fakeSupabase.reset()
    queueAccess()
    mockGetVideoDetails.mockRejectedValue(new Error('provider detail'))
    const providerFailure = await POST(mobileRequest({ videoId: APP_VIDEO_ID }))
    expect(providerFailure.status).toBe(502)
    expect((await providerFailure.json()).error).not.toContain('provider detail')
  })
})
