import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'

const mockGetUser = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

const mockGetVideoDetails = vi.fn()
const mockGenerateSignedUrl = vi.fn()

vi.mock('../../../../../src/services/cloudflare-stream', () => ({
  videoManagement: {
    getVideoDetails: (...args: unknown[]) => mockGetVideoDetails(...args),
    generateSignedUrl: (...args: unknown[]) => mockGenerateSignedUrl(...args),
  },
}))

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

describe('POST /api/mobile/video/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@test.com' } },
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
    const res = (await POST(
      createNextRequest('/api/mobile/video/signed-url', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'v1' }),
      })
    ))!
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })

    const res = (await POST(mobileRequest({ videoId: 'v1' })))!
    expect(res.status).toBe(401)
  })

  it('returns 400 when videoId missing', async () => {
    const res = (await POST(mobileRequest({})))!
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Video ID is required')
  })

  it('returns 404 when video not in Cloudflare', async () => {
    mockGetVideoDetails.mockRejectedValueOnce(new Error('missing'))

    const res = (await POST(mobileRequest({ videoId: 'missing' })))!
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Video not found in Cloudflare Stream')
  })

  it('generates signed url successfully', async () => {
    const res = (await POST(
      mobileRequest({ videoId: 'cf-1', subscriptionTier: 'tier2', format: 'hls' })
    ))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      signed_url: 'https://stream.example/video.m3u8?token=abc',
      video_id: 'cf-1',
      duration: 120,
      thumbnail_url: 'https://thumb',
    })
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      'cf-1',
      'tier2',
      expect.objectContaining({ downloadable: false }),
      'hls'
    )
  })

  it('supports mp4 format and tolerates HEAD probe failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const res = (await POST(
      mobileRequest({ videoId: 'cf-1', subscriptionTier: 'none', format: 'mp4' })
    ))!
    expect(res.status).toBe(200)
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      'cf-1',
      'none',
      expect.objectContaining({ downloadable: true }),
      'mp4'
    )
  })

  it('returns 404 when generateSignedUrl throws Not Found', async () => {
    mockGetVideoDetails.mockResolvedValueOnce({ status: 'ready', duration: 1, readyToStream: true })
    mockGenerateSignedUrl.mockRejectedValue(new Error('Not Found'))

    const res = (await POST(mobileRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Video not found')
  })

  it('returns 500 for generic generation errors', async () => {
    mockGenerateSignedUrl.mockRejectedValue(new Error('signing failed'))

    const res = (await POST(mobileRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to generate signed video URL')
  })

  it('returns 500 when auth throws', async () => {
    mockGetUser.mockRejectedValue(new Error('auth crash'))

    const res = (await POST(mobileRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Authentication failed')
  })
})
