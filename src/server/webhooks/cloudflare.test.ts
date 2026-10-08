import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './cloudflare'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

const WEBHOOK_SECRET = 'test-stream-webhook-secret'
// Valid 32-char lowercase hex video ID (from Cloudflare docs sample)
const VALID_VIDEO_UID = '6b9e68b07dfee8cc2d116e4c51d6a957'

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

// Helper to assert no console method received any part of the payload
function assertNoPayloadLogged(
  spies: { log: ReturnType<typeof vi.spyOn>; info: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn>; debug: ReturnType<typeof vi.spyOn> },
  payloadParts: string[]
) {
  for (const [name, spy] of Object.entries(spies)) {
    for (const call of spy.mock.calls) {
      const callStr = call.map((arg: unknown) => String(arg)).join(' ')
      for (const part of payloadParts) {
        expect(callStr, `console.${name} should not contain payload part "${part}"`).not.toContain(part)
      }
    }
  }
}

import { createAdminClient } from '@/src/lib/supabase'

const mockCreateAdminClient = vi.mocked(createAdminClient)

// Generate signature in Cloudflare Stream format: time=<unix_ts>,sig1=<hex>
function signPayload(payload: string, secret = WEBHOOK_SECRET, timestamp?: number) {
  const time = timestamp ?? Math.floor(Date.now() / 1000)
  const sourceString = `${time}.${payload}`
  const sig = crypto.createHmac('sha256', secret).update(sourceString).digest('hex')
  return `time=${time},sig1=${sig}`
}

// Build payload matching Cloudflare Stream webhook format from the docs
// See: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
function buildWebhookPayload(overrides: Partial<{
  uid: string
  readyToStream: boolean
  status: { state: string; pctComplete?: string; errorReasonCode?: string; errorReasonText?: string }
  duration: number
  input: { width: number; height: number }
  playback: { hls: string; dash: string }
  thumbnail: string
  preview: string
  size: number
  meta: Record<string, unknown>
  created: string
  modified: string
}> = {}) {
  return {
    uid: VALID_VIDEO_UID,
    readyToStream: true,
    status: {
      state: 'ready',
      pctComplete: '100.000000',
      errorReasonCode: '',
      errorReasonText: ''
    },
    meta: { filename: 'test.mp4', name: 'test.mp4' },
    created: '2022-06-30T17:53:12.512033Z',
    modified: '2022-06-30T17:53:21.774299Z',
    duration: 120,
    input: { width: 1920, height: 1080 },
    playback: { hls: 'https://example.invalid/manifest/video.m3u8', dash: 'https://example.invalid/manifest/video.mpd' },
    thumbnail: 'https://example.invalid/thumbnails/thumbnail.jpg',
    preview: 'https://example.invalid/watch',
    size: 1024,
    ...overrides,
  }
}

function buildSupabase(videoFound = true) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const videoSingle = vi.fn().mockResolvedValue({
    data: videoFound
      ? { id: 'db-video-1', title: 'Test Video', cloudflare_video_id: VALID_VIDEO_UID }
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
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }

    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)
    const now = Math.floor(Date.now() / 1000)
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': `time=${now},sig1=invalid` },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid signature')
    expect(supabase.update).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalledWith('webhook_logs')
    assertNoPayloadLogged(spies, [webhookPayload.uid, 'ready', 'test.mp4'])

    Object.values(spies).forEach(spy => spy.mockRestore())
  })

  it('returns 401 for same-length wrong signature', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }

    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)
    const now = Math.floor(Date.now() / 1000)
    // A different 64-char hex string (same length as valid sig)
    const wrongSig = '0'.repeat(64)
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': `time=${now},sig1=${wrongSig}` },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid signature')
    expect(supabase.update).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalledWith('webhook_logs')
    assertNoPayloadLogged(spies, [webhookPayload.uid, 'ready', 'test.mp4'])

    Object.values(spies).forEach(spy => spy.mockRestore())
  })

  it('returns 401 for timestamp older than 5 minutes', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }

    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 6+ minutes ago
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signPayload(payload, WEBHOOK_SECRET, oldTimestamp) },
      })
    )

    expect(res.status).toBe(401)
    expect(supabase.from).not.toHaveBeenCalledWith('webhook_logs')
    assertNoPayloadLogged(spies, [webhookPayload.uid, 'ready', 'test.mp4'])

    Object.values(spies).forEach(spy => spy.mockRestore())
  })

  it('returns 401 for timestamp more than 5 minutes in the future', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }

    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)
    const futureTimestamp = Math.floor(Date.now() / 1000) + 400 // 6+ minutes in future
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signPayload(payload, WEBHOOK_SECRET, futureTimestamp) },
      })
    )

    expect(res.status).toBe(401)
    expect(supabase.from).not.toHaveBeenCalledWith('webhook_logs')
    assertNoPayloadLogged(spies, [webhookPayload.uid, 'ready', 'test.mp4'])

    Object.values(spies).forEach(spy => spy.mockRestore())
  })

  it('returns 401 when signature header missing', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }

    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
      })
    )

    expect(res.status).toBe(401)
    expect(supabase.from).not.toHaveBeenCalledWith('webhook_logs')
    assertNoPayloadLogged(spies, [webhookPayload.uid, 'ready', 'test.mp4'])

    Object.values(spies).forEach(spy => spy.mockRestore())
  })

  it('processes ready state by writing status and stream metadata but NOT is_published', async () => {
    const webhookPayload = buildWebhookPayload({
      status: { state: 'ready', pctComplete: '100.000000', errorReasonCode: '', errorReasonText: '' },
      readyToStream: true,
    })
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      videoUid: VALID_VIDEO_UID,
      state: 'ready',
      updated: true,
    })
    // Verify is_published is NOT included - admins control publishing
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('is_published')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'ready',
        duration_seconds: 120,
        resolution: '1920x1080',
        hls_url: 'https://example.invalid/manifest/video.m3u8',
        dash_url: 'https://example.invalid/manifest/video.mpd',
        thumbnail_url: 'https://example.invalid/thumbnails/thumbnail.jpg',
        preview_url: 'https://example.invalid/watch',
        file_size: 1024,
      })
    )
    expect(supabase.updateEq).toHaveBeenCalledWith('id', 'db-video-1')
  })

  it('processes inprogress state by writing processing status without is_published', async () => {
    const webhookPayload = buildWebhookPayload({
      status: { state: 'inprogress', pctComplete: '50.000000', errorReasonCode: '', errorReasonText: '' },
      readyToStream: false,
    })
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.updated).toBe(true)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('is_published')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'processing',
      })
    )
  })

  it('processes error state by writing error status and reason without is_published', async () => {
    const webhookPayload = buildWebhookPayload({
      status: { state: 'error', errorReasonCode: 'ERR_TRANSCODE', errorReasonText: 'Transcode failed' },
      readyToStream: false,
    })
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )

    expect(res.status).toBe(200)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('is_published')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'error',
        error_code: 'ERR_TRANSCODE',
        error_message: 'Transcode failed',
      })
    )
  })

  it('processes queued state by writing processing status without is_published', async () => {
    const webhookPayload = buildWebhookPayload({
      status: { state: 'queued', pctComplete: '0.000000', errorReasonCode: '', errorReasonText: '' },
      readyToStream: false,
    })
    const payload = JSON.stringify(webhookPayload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signPayload(payload) },
      })
    )

    expect(res.status).toBe(200)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('is_published')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ processing_status: 'processing' })
    )
  })

  it('makes NO database write for unknown state (no-op)', async () => {
    const webhookPayload = {
      uid: VALID_VIDEO_UID,
      readyToStream: false,
      status: { state: 'some-future-state' },
      meta: {},
      created: '2022-06-30T17:53:12.512033Z',
      modified: '2022-06-30T17:53:21.774299Z',
    }
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.updated).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('makes NO database write when status field is missing entirely', async () => {
    const webhookPayload = {
      uid: VALID_VIDEO_UID,
      readyToStream: true,
      meta: {},
      created: '2022-06-30T17:53:12.512033Z',
      modified: '2022-06-30T17:53:21.774299Z',
    }
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.updated).toBe(false)
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid uid format before database lookup', async () => {
    const webhookPayload = buildWebhookPayload({ uid: 'not-valid-hex' })
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid video ID format')
    expect(supabase.from).not.toHaveBeenCalledWith('videos')
  })

  // Real timers: the handler awaits WebCrypto between retries, which races
  // fake-timer flushing on slow runners. Worst case is ~7s of retry backoff.
  it('returns 500 when video not found in database', { timeout: 30_000 }, async () => {
    supabase = buildSupabase(false)
    mockCreateAdminClient.mockReturnValue(supabase as never)
    const webhookPayload = buildWebhookPayload()
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const resPromise = POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )
    const res = await resPromise
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Webhook processing failed')
    expect(body.message).toContain('not found')
    expect(supabase.update).not.toHaveBeenCalled()
  })

  it('processes ready but not readyToStream as processing state without is_published', async () => {
    const webhookPayload = buildWebhookPayload({
      status: { state: 'ready', pctComplete: '100.000000', errorReasonCode: '', errorReasonText: '' },
      readyToStream: false,
    })
    const payload = JSON.stringify(webhookPayload)
    const signature = signPayload(payload)

    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': signature },
      })
    )

    expect(res.status).toBe(200)
    const updateArg = supabase.update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('is_published')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_status: 'processing',
      })
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
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    const invalidPayload = 'not-json'
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: invalidPayload,
        headers: { 'Webhook-Signature': signPayload(invalidPayload) },
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON payload')
  })
})

describe('POST /api/webhooks/cloudflare secret configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)
  })

  it('returns 503 when webhook secret is not configured', async () => {
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET

    const payload = JSON.stringify(buildWebhookPayload())
    const res = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: payload,
        headers: { 'Webhook-Signature': 'time=1234567890,sig1=any' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe('Webhook not configured')
  })
})
