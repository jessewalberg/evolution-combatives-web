import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './cloudflare'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

const WEBHOOK_SECRET = 'test-stream-webhook-secret'

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/src/lib/supabase'

const mockCreateAdminClient = vi.mocked(createAdminClient)

function signPayload(payload: string, secret = WEBHOOK_SECRET) {
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `sha256=${digest}`
}

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-1',
    eventTimestamp: new Date().toISOString(),
    eventType: 'video.ready',
    uid: 'cf-video-1',
    duration: 120,
    input: { width: 1920, height: 1080 },
    playback: { hls: 'https://hls', dash: 'https://dash' },
    thumbnail: 'https://thumb',
    preview: 'https://preview',
    size: 1024,
    ...overrides,
  }
}

function buildSupabase(videoFound = true) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const videoSingle = vi.fn().mockResolvedValue({
    data: videoFound
      ? { id: 'db-video-1', title: 'Test Video', cloudflare_video_id: 'cf-video-1' }
      : null,
    error: videoFound ? null : { message: 'not found' },
  })

  const from = vi.fn((table: string) => {
    if (table === 'videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: videoSingle }),
        }),
        update,
      }
    }
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'admin-1', email: 'admin@test.com', admin_role: 'super_admin' }],
            error: null,
          }),
        }),
      }
    }
    if (table === 'notifications' || table === 'system_logs' || table === 'webhook_logs') {
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    return {}
  })

  return { from, update, updateEq }
}

describe('POST /api/webhooks/cloudflare', () => {
  let supabase: ReturnType<typeof buildSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase as never)
  })

  it('returns 401 for invalid signature', async () => {
    const payload = JSON.stringify(buildEvent())
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': 'sha256=invalid' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid signature')
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('processes video.ready by writing status, publish flag, and stream metadata', async () => {
    const event = buildEvent({ eventType: 'video.ready' })
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signature },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      eventId: 'evt-1',
      eventType: 'video.ready',
      videoUid: 'cf-video-1',
    })
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'ready',
        is_published: true,
        duration_seconds: 120,
        resolution: '1920x1080',
        hls_url: 'https://hls',
        dash_url: 'https://dash',
        thumbnail_url: 'https://thumb',
        preview_url: 'https://preview',
        file_size: 1024,
      })
    )
    expect(supabase.updateEq).toHaveBeenCalledWith('id', 'db-video-1')
  })

  it('processes video.processing.failed by writing error status and reason', async () => {
    const event = buildEvent({
      eventType: 'video.processing.failed',
      status: { state: 'error', errorReasonCode: 'E001', errorReasonText: 'Transcode failed' },
    })
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signature },
      })
    )

    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'error',
        is_published: false,
        error_code: 'E001',
        error_message: 'Transcode failed',
      })
    )
  })

  it('returns 500 when video not found in database', { timeout: 20_000 }, async () => {
    vi.useFakeTimers()
    supabase = buildSupabase(false)
    mockCreateAdminClient.mockReturnValue(supabase as never)
    const event = buildEvent()
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

    const resPromise = POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signature },
      })
    )
    // Signature verification is now async (WebCrypto), so retry timers get
    // scheduled after additional microtasks; flush until the handler
    // settles (slow CI runners need more passes than fast machines).
    let settled = false
    void resPromise.finally(() => { settled = true })
    for (let i = 0; i < 50 && !settled; i++) {
      await vi.runAllTimersAsync()
    }
    const res = await resPromise
    const body = await res.json()
    vi.useRealTimers()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Webhook processing failed')
    expect(body.message).toContain('not found')
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('returns 401 when signature header missing', async () => {
        const payload = JSON.stringify(buildEvent())

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(401)
  })

  it('processes video.upload.complete by marking status processing and unpublished', async () => {
    const event = buildEvent({ eventType: 'video.upload.complete' })
    const payload = JSON.stringify(event)
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signPayload(payload) },
      })
    )
    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'processing', is_published: false })
    )
  })

  it('processes video.processing.started by marking status processing and unpublished', async () => {
    const event = buildEvent({ eventType: 'video.processing.started' })
    const payload = JSON.stringify(event)
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signPayload(payload) },
      })
    )
    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'processing', is_published: false })
    )
  })

  it('processes video.processing.complete by writing ready status and metadata', async () => {
    const event = buildEvent({ eventType: 'video.processing.complete' })
    const payload = JSON.stringify(event)
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signPayload(payload) },
      })
    )
    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'ready',
        is_published: true,
        duration_seconds: 120,
        resolution: '1920x1080',
      })
    )
  })

  it('processes video.deleted by marking status deleted and unpublished', async () => {
    const event = buildEvent({ eventType: 'video.deleted' })
    const payload = JSON.stringify(event)
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signPayload(payload) },
      })
    )
    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'deleted', is_published: false })
    )
  })

  it('handles unknown event types via default branch, writing queued status', async () => {
    const event = buildEvent({ eventType: 'video.unknown' as never })
    const payload = JSON.stringify(event)
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': signPayload(payload) },
      })
    )
    expect(res.status).toBe(200)
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'queued', is_published: false })
    )
  })
})

describe('GET /api/webhooks/cloudflare', () => {
  it('returns endpoint info', async () => {
    const { GET, PUT, DELETE } = await import('./cloudflare')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toContain('Cloudflare Stream webhook')
    expect((await PUT()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })
})

describe('POST /api/webhooks/cloudflare payload validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)
  })

  it('returns 400 for empty payload', async () => {
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: '',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Empty payload')
  })

  it('returns 400 for invalid JSON', async () => {
        const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: 'not-json',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON payload')
  })
})
