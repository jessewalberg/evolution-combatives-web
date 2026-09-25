import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

vi.mock('../../../../src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '../../../../src/lib/supabase'
import {
  DELETE,
  GET,
  POST,
  PUT,
} from './route'
import { verifyCloudflareWebhookSignature } from './signature'

const WEBHOOK_SECRET = 'test-stream-webhook-secret'
const NOW_SECONDS = 1_800_000_000
const THUMBNAIL_URL =
  'https://customer.example.cloudflarestream.com/cf-video-1/thumbnails/thumbnail.jpg'

const mockCreateAdminClient = vi.mocked(createAdminClient)

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'cf-video-1',
    readyToStream: true,
    status: {
      state: 'ready',
      pctComplete: '100.000000',
      errorReasonCode: '',
      errorReasonText: '',
    },
    meta: { name: 'Test video' },
    created: '2026-08-18T12:00:00.000Z',
    modified: '2026-08-18T12:02:00.000Z',
    duration: 120.4,
    size: 1024,
    thumbnail: THUMBNAIL_URL,
    playback: {
      hls: 'https://customer.example.cloudflarestream.com/cf-video-1/manifest/video.m3u8',
      dash: 'https://customer.example.cloudflarestream.com/cf-video-1/manifest/video.mpd',
    },
    input: { width: 1920, height: 1080 },
    ...overrides,
  }
}

function signPayload(
  rawBody: string,
  timestamp = NOW_SECONDS,
  secret = WEBHOOK_SECRET
) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  return `time=${timestamp},sig1=${digest}`
}

function requestFor(
  rawBody: string,
  signature = signPayload(rawBody),
  extraHeaders: Record<string, string> = {}
) {
  return createNextRequest('/api/webhooks/cloudflare', {
    method: 'POST',
    headers: {
      'Webhook-Signature': signature,
      ...extraHeaders,
    },
    body: rawBody,
  })
}

function storedVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'db-video-1',
    processing_status: 'processing',
    is_published: false,
    duration_seconds: 0,
    thumbnail_url: null,
    file_size: null,
    ...overrides,
  }
}

describe('Cloudflare Stream signature verification', () => {
  it('accepts the official time.body HMAC contract without normalizing the body', () => {
    const rawBody = `${JSON.stringify(buildPayload())}\n`

    expect(
      verifyCloudflareWebhookSignature(
        rawBody,
        signPayload(rawBody),
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: true, timestamp: NOW_SECONDS })

    expect(
      verifyCloudflareWebhookSignature(
        rawBody.trim(),
        signPayload(rawBody),
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: false, reason: 'mismatch' })
  })

  it('supports key rotation headers containing more than one sig1 value', () => {
    const rawBody = JSON.stringify(buildPayload())
    const valid = signPayload(rawBody).split('sig1=')[1]
    const header = `time=${NOW_SECONDS},sig1=${'0'.repeat(64)},sig1=${valid}`

    expect(
      verifyCloudflareWebhookSignature(
        rawBody,
        header,
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: true, timestamp: NOW_SECONDS })
  })

  it.each([
    [null, 'missing'],
    ['', 'missing'],
    [`sig1=${'0'.repeat(64)}`, 'malformed'],
    [`time=${NOW_SECONDS}`, 'malformed'],
    [`time=${NOW_SECONDS},time=${NOW_SECONDS},sig1=${'0'.repeat(64)}`, 'malformed'],
    [`time=not-a-number,sig1=${'0'.repeat(64)}`, 'malformed'],
    [`time=${NOW_SECONDS},sig1=not-hex`, 'mismatch'],
  ])('rejects an invalid header %#', (header, reason) => {
    expect(
      verifyCloudflareWebhookSignature(
        '{}',
        header,
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: false, reason })
  })

  it('rejects stale and implausibly future timestamps while accepting the boundary', () => {
    const rawBody = JSON.stringify(buildPayload())

    expect(
      verifyCloudflareWebhookSignature(
        rawBody,
        signPayload(rawBody, NOW_SECONDS - 301),
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: false, reason: 'expired' })
    expect(
      verifyCloudflareWebhookSignature(
        rawBody,
        signPayload(rawBody, NOW_SECONDS + 301),
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: false, reason: 'expired' })
    expect(
      verifyCloudflareWebhookSignature(
        rawBody,
        signPayload(rawBody, NOW_SECONDS - 300),
        WEBHOOK_SECRET,
        NOW_SECONDS * 1000
      )
    ).toEqual({ valid: true, timestamp: NOW_SECONDS - 300 })
  })
})

describe('POST /api/webhooks/cloudflare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(NOW_SECONDS * 1000)
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET
  })

  it('fails closed when webhook verification is not configured', async () => {
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET
    const rawBody = JSON.stringify(buildPayload())

    const response = await POST(requestFor(rawBody))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook verification is not configured',
    })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects missing, legacy, and incorrectly signed headers before database access', async () => {
    const rawBody = JSON.stringify(buildPayload())
    const missing = createNextRequest('/api/webhooks/cloudflare', {
      method: 'POST',
      body: rawBody,
    })
    const legacy = createNextRequest('/api/webhooks/cloudflare', {
      method: 'POST',
      headers: { 'x-signature': signPayload(rawBody) },
      body: rawBody,
    })

    for (const request of [
      missing,
      legacy,
      requestFor(rawBody, signPayload(rawBody, NOW_SECONDS, 'wrong-secret')),
    ]) {
      const response = await POST(request)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid signature',
      })
    }

    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects replayed requests before database access', async () => {
    const rawBody = JSON.stringify(buildPayload())
    const response = await POST(
      requestFor(rawBody, signPayload(rawBody, NOW_SECONDS - 301))
    )

    expect(response.status).toBe(401)
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('validates the signed JSON and current Stream payload shape', async () => {
    const empty = await POST(
      createNextRequest('/api/webhooks/cloudflare', {
        method: 'POST',
        body: '',
      })
    )
    expect(empty.status).toBe(400)
    expect((await empty.json()).error).toBe('Empty payload')

    const invalidJson = 'not-json'
    const invalidJsonResponse = await POST(requestFor(invalidJson))
    expect(invalidJsonResponse.status).toBe(400)
    expect((await invalidJsonResponse.json()).error).toBe(
      'Invalid JSON payload'
    )

    const obsoleteEnvelope = JSON.stringify({
      eventId: 'evt-1',
      eventType: 'video.ready',
      uid: 'cf-video-1',
    })
    const obsoleteResponse = await POST(requestFor(obsoleteEnvelope))
    expect(obsoleteResponse.status).toBe(400)
    expect((await obsoleteResponse.json()).error).toBe(
      'Invalid webhook payload'
    )
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('stores terminal ready metadata without auto-publishing or invented columns', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({ data: storedVideo(), error: null })
    supabase.queueResult({ data: null, error: null })
    mockCreateAdminClient.mockReturnValue(supabase as never)
    const rawBody = `${JSON.stringify(buildPayload())}\n`

    const response = await POST(requestFor(rawBody))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      videoUid: 'cf-video-1',
      state: 'ready',
      videoId: 'db-video-1',
      updated: true,
      ignored: false,
    })

    const update = supabase.calls.find((call) => call.method === 'update')
    expect(update?.table).toBe('videos')
    expect(update?.payload).toEqual({
      processing_status: 'ready',
      duration_seconds: 120,
      thumbnail_url: THUMBNAIL_URL,
      file_size: 1024,
      updated_at: expect.any(String),
    })
    expect(update?.filters).toEqual(
      expect.arrayContaining([
        { type: 'eq', args: ['id', 'db-video-1'] },
        { type: 'eq', args: ['cloudflare_video_id', 'cf-video-1'] },
      ])
    )
    expect(update?.payload).not.toHaveProperty('is_published')
    expect(update?.payload).not.toHaveProperty('hls_url')
    expect(update?.payload).not.toHaveProperty('dash_url')
    expect(update?.payload).not.toHaveProperty('resolution')
    expect(update?.payload).not.toHaveProperty('preview_url')
  })

  it('preserves an explicit published state when a ready delivery arrives', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({
      data: storedVideo({ is_published: true }),
      error: null,
    })
    supabase.queueResult({ data: null, error: null })
    mockCreateAdminClient.mockReturnValue(supabase as never)

    const response = await POST(requestFor(JSON.stringify(buildPayload())))

    expect(response.status).toBe(200)
    const update = supabase.calls.find((call) => call.method === 'update')
    expect(update?.payload).not.toHaveProperty('is_published')
  })

  it('marks terminal errors unavailable using actual Stream error fields', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({
      data: storedVideo({ processing_status: 'ready', is_published: true }),
      error: null,
    })
    supabase.queueResult({ data: null, error: null })
    mockCreateAdminClient.mockReturnValue(supabase as never)
    const rawBody = JSON.stringify(
      buildPayload({
        readyToStream: false,
        status: {
          state: 'error',
          pctComplete: '67.500000',
          errReasonCode: 'ERR_NON_VIDEO',
          errReasonText: 'The uploaded file is not a supported video.',
        },
      })
    )

    const response = await POST(requestFor(rawBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      state: 'error',
      updated: true,
      ignored: false,
    })
    const update = supabase.calls.find((call) => call.method === 'update')
    expect(update?.payload).toEqual({
      processing_status: 'error',
      is_published: false,
      updated_at: expect.any(String),
    })
    expect(update?.payload).not.toHaveProperty('error_code')
    expect(update?.payload).not.toHaveProperty('error_message')
  })

  it('makes duplicate terminal delivery a no-op when stored state already matches', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({
      data: storedVideo({
        processing_status: 'ready',
        is_published: true,
        duration_seconds: 120,
        thumbnail_url: THUMBNAIL_URL,
        file_size: 1024,
      }),
      error: null,
    })
    mockCreateAdminClient.mockReturnValue(supabase as never)

    const response = await POST(requestFor(JSON.stringify(buildPayload())))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      videoId: 'db-video-1',
      updated: false,
      ignored: false,
    })
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0].method).toBe('select')
  })

  it.each([
    ['inprogress', false],
    ['queued', false],
    ['ready', false],
  ])(
    'acknowledges unexpected non-terminal state %s without changing the database',
    async (state, readyToStream) => {
      const rawBody = JSON.stringify(
        buildPayload({ readyToStream, status: { state, pctComplete: '50' } })
      )

      const response = await POST(requestFor(rawBody))

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        success: true,
        state,
        updated: false,
        ignored: true,
      })
      expect(mockCreateAdminClient).not.toHaveBeenCalled()
    }
  )

  it('fails closed and exposes no database detail when the video lookup fails', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({
      data: null,
      error: { message: 'connection string and private table detail' },
    })
    mockCreateAdminClient.mockReturnValue(supabase as never)

    const response = await POST(requestFor(JSON.stringify(buildPayload())))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook processing failed',
    })
    expect(supabase.calls).toHaveLength(1)
  })

  it('returns a retryable generic failure when the deterministic update fails', async () => {
    const supabase = createFakeSupabaseClient()
    supabase.queueResult({ data: storedVideo(), error: null })
    supabase.queueResult({ data: null, error: { message: 'write failed' } })
    mockCreateAdminClient.mockReturnValue(supabase as never)

    const response = await POST(requestFor(JSON.stringify(buildPayload())))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Webhook processing failed',
    })
    expect(supabase.calls.filter((call) => call.method === 'update')).toHaveLength(
      1
    )
  })
})

describe('other /api/webhooks/cloudflare methods', () => {
  it('exposes endpoint information and rejects unsupported methods', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: 'Cloudflare Stream webhook endpoint',
    })
    expect((await PUT()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })
})
