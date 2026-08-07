import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'

const WEBHOOK_SECRET = 'test-stream-webhook-secret'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('../../../../src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { headers } from 'next/headers'
import { createAdminClient } from '../../../../src/lib/supabase'

const mockHeaders = vi.mocked(headers)
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
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)
  })

  it('returns 401 for invalid signature', async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': 'sha256=invalid' }) as never
    )
    const payload = JSON.stringify(buildEvent())
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid signature')
  })

  it('processes video.ready with valid HMAC signature', async () => {
    const event = buildEvent({ eventType: 'video.ready' })
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signature }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
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
    expect(mockCreateAdminClient).toHaveBeenCalled()
  })

  it('processes video.processing.failed event', async () => {
    const event = buildEvent({
      eventType: 'video.processing.failed',
      status: { state: 'error', errorReasonCode: 'E001', errorReasonText: 'Transcode failed' },
    })
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signature }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )

    expect(res.status).toBe(200)
  })

  it('returns 500 when video not found in database', async () => {
    vi.useFakeTimers()
    mockCreateAdminClient.mockReturnValue(buildSupabase(false) as never)
    const event = buildEvent()
    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signature }) as never
    )

    const resPromise = POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    await vi.runAllTimersAsync()
    const res = await resPromise
    const body = await res.json()
    vi.useRealTimers()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Webhook processing failed')
    expect(body.message).toContain('not found')
  })

  it('returns 401 when signature header missing', async () => {
    mockHeaders.mockResolvedValue(new Headers({}) as never)
    const payload = JSON.stringify(buildEvent())

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(401)
  })

  it('processes video.upload.complete', async () => {
    const event = buildEvent({ eventType: 'video.upload.complete' })
    const payload = JSON.stringify(event)
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signPayload(payload) }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(200)
  })

  it('processes video.processing.started', async () => {
    const event = buildEvent({ eventType: 'video.processing.started' })
    const payload = JSON.stringify(event)
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signPayload(payload) }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(200)
  })

  it('processes video.processing.complete', async () => {
    const event = buildEvent({ eventType: 'video.processing.complete' })
    const payload = JSON.stringify(event)
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signPayload(payload) }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(200)
  })

  it('processes video.deleted', async () => {
    const event = buildEvent({ eventType: 'video.deleted' })
    const payload = JSON.stringify(event)
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signPayload(payload) }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(200)
  })

  it('handles unknown event types via default branch', async () => {
    const event = buildEvent({ eventType: 'video.unknown' as never })
    const payload = JSON.stringify(event)
    mockHeaders.mockResolvedValue(
      new Headers({ 'x-signature': signPayload(payload) }) as never
    )

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )
    expect(res.status).toBe(200)
  })
})

describe('GET /api/webhooks/cloudflare', () => {
  it('returns endpoint info', async () => {
    const { GET, PUT, DELETE } = await import('./route')
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
    mockHeaders.mockResolvedValue(new Headers({}) as never)
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
    mockHeaders.mockResolvedValue(new Headers({}) as never)
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
