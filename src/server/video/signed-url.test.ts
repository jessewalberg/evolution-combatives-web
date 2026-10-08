import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './signed-url'

const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

const mockGetUser = vi.fn()
const mockProfileSelect = vi.fn()
const mockAdminVideoSelect = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: mockProfileSelect }) }) }
      }
      return { select: () => ({ eq: () => ({ single: vi.fn() }) }) }
    },
  })),
}))

vi.mock('@/src/lib/supabase', () => ({
  getSupabaseConfig: () => ({ url: 'https://test.supabase.co', anonKey: 'anon-key' }),
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'videos') {
        return { select: () => ({ eq: () => ({ single: mockAdminVideoSelect }) }) }
      }
      return { select: () => ({ eq: () => ({ single: vi.fn() }) }) }
    },
  }),
}))

const mockGetVideoDetails = vi.fn()
const mockGenerateSignedUrl = vi.fn()

vi.mock('@/src/services/cloudflare-stream', () => ({
  videoManagement: {
    getVideoDetails: (...args: unknown[]) => mockGetVideoDetails(...args),
    generateSignedUrl: (...args: unknown[]) => mockGenerateSignedUrl(...args),
  },
}))

function authRequest(body: Record<string, unknown>) {
  return createNextRequest('/api/video/signed-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer valid-token' },
  })
}

describe('POST /api/video/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@test.com' } },
      error: null,
    })
    mockProfileSelect.mockResolvedValue({
      data: { subscription_tier: 'tier3' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier1', cloudflare_video_id: 'cf-1', title: 'Test Video' },
      error: null,
    })
    mockGetVideoDetails.mockResolvedValue({
      status: 'ready',
      duration: 90,
      readyToStream: true,
      thumbnail: 'https://thumb',
    })
    mockGenerateSignedUrl.mockResolvedValue('https://stream.example/video.m3u8?token=xyz')
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
      createNextRequest('/api/video/signed-url', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'v1' }),
      })
    ))!
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Authentication required')
  })

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })

    const res = (await POST(authRequest({ videoId: 'v1' })))!
    expect(res.status).toBe(401)
  })

  it('returns 400 when videoId missing', async () => {
    const res = (await POST(authRequest({})))!
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Video ID is required')
  })

  it('returns 404 when video missing in Cloudflare', async () => {
    mockGetVideoDetails.mockRejectedValueOnce(new Error('gone'))

    const res = (await POST(authRequest({ videoId: 'missing' })))!
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Video not found in Cloudflare Stream')
  })

  it('generates signed url using user actual tier (tier3 user)', async () => {
    const res = (await POST(
      authRequest({ videoId: 'cf-1', format: 'mp4' })
    ))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.signed_url).toContain('token=')
    // Should use user's actual tier (tier3) not any client-provided value
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      'cf-1',
      'tier3',
      expect.objectContaining({ downloadable: true }),
      'mp4'
    )
  })

  it('returns 403 when user tier insufficient for video', async () => {
    mockProfileSelect.mockResolvedValue({
      data: { subscription_tier: 'tier1' },
      error: null,
    })
    mockAdminVideoSelect.mockResolvedValue({
      data: { id: 'vid-1', tier_required: 'tier3', cloudflare_video_id: 'cf-1', title: 'Premium Video' },
      error: null,
    })

    const res = (await POST(authRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Subscription tier too low')
  })

  it('tolerates HEAD probe failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const res = (await POST(authRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(200)
  })

  it('returns 404 for Not Found from generateSignedUrl', async () => {
    mockGenerateSignedUrl.mockRejectedValue(new Error('Not Found'))

    const res = (await POST(authRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(404)
  })

  it('returns 500 for generic errors', async () => {
    mockGenerateSignedUrl.mockRejectedValue(new Error('boom'))

    const res = (await POST(authRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to generate signed video URL')
  })

  it('returns 500 when auth throws', async () => {
    mockGetUser.mockRejectedValue(new Error('auth crash'))

    const res = (await POST(authRequest({ videoId: 'cf-1' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Authentication failed')
  })
})
