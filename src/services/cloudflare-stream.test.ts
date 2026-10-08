/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  uploadFunctions,
  videoManagement,
  webhookHandling,
  securityFunctions,
  CloudflareStreamError,
  CloudflareStreamUploadError,
  cloudflareStreamService,
} from './cloudflare-stream'
import cloudflareStreamServiceDefault from './cloudflare-stream'

vi.mock('../lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('../lib/shared/utils/supabase-errors', () => ({
  handleSupabaseError: vi.fn((error: unknown) => {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
    return new Error(`supabase: ${message}`)
  }),
}))

import { createAdminClient } from '../lib/supabase'

const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockFetch = vi.fn()

// Valid 32-character lowercase hex video ID for tests
const VALID_VIDEO_ID = 'abcdef01234567890abcdef012345678'
const VALID_VIDEO_ID_2 = 'fedcba98765432100fedcba987654321'
const VALID_VIDEO_ID_3 = '00112233445566778899aabbccddeeff'

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { entries: () => [] },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function textResponse(text: string, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { entries: () => [] },
    text: async () => text,
    json: async () => JSON.parse(text),
  }
}

describe('CloudflareStreamError classes', () => {
  it('CloudflareStreamError sets name, code, and details', () => {
    const err = new CloudflareStreamError('boom', 418, { reason: 'teapot' })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(CloudflareStreamError)
    expect(err.name).toBe('CloudflareStreamError')
    expect(err.message).toBe('boom')
    expect(err.code).toBe(418)
    expect(err.details).toEqual({ reason: 'teapot' })
  })

  it('CloudflareStreamUploadError extends CloudflareStreamError with uploadId', () => {
    const err = new CloudflareStreamUploadError('upload failed', 'uid-9', { status: 500 })
    expect(err).toBeInstanceOf(CloudflareStreamError)
    expect(err).toBeInstanceOf(CloudflareStreamUploadError)
    expect(err.name).toBe('CloudflareStreamUploadError')
    expect(err.message).toBe('upload failed')
    expect(err.uploadId).toBe('uid-9')
    expect(err.details).toEqual({ status: 500 })
    expect(err.code).toBeUndefined()
  })
})

describe('uploadFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getUploadUrl returns uploadUrl and videoId with optional fields', async () => {
    mockFetch.mockResolvedValue(
      textResponse(
        JSON.stringify({
          success: true,
          result: { uid: 'vid-1', uploadURL: 'https://upload.example/upload' },
          errors: [],
        })
      )
    )

    const result = await uploadFunctions.getUploadUrl({
      maxDurationSeconds: 600,
      requireSignedURLs: true,
      thumbnailTimestampPct: 0.5,
      creator: 'admin',
      expiry: '2026-01-01',
      scheduledDeletion: '2026-02-01',
      allowedOrigins: ['https://app.example'],
      metadata: { name: 'Intro', ignored: 'x' },
    })
    expect(result).toEqual({
      uploadUrl: 'https://upload.example/upload',
      videoId: 'vid-1',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.requireSignedURLs).toBe(true)
    expect(body.meta).toEqual({ name: 'Intro' })
    expect(body.maxDurationSeconds).toBe(600)
  })

  it('getUploadUrl omits empty allowedOrigins and non-name metadata', async () => {
    mockFetch.mockResolvedValue(
      textResponse(
        JSON.stringify({
          success: true,
          result: { uid: 'vid-empty', uploadURL: 'https://upload.example/e' },
          errors: [],
        })
      )
    )

    await uploadFunctions.getUploadUrl({
      allowedOrigins: [],
      metadata: { name: '', other: 'skip' },
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.allowedOrigins).toBeUndefined()
    expect(body.meta).toBeUndefined()
    expect(body.maxDurationSeconds).toBe(3600)
  })

  it('getUploadUrl always sets requireSignedURLs to true', async () => {
    mockFetch.mockResolvedValue(
      textResponse(
        JSON.stringify({
          success: true,
          result: { uid: 'vid-signed', uploadURL: 'https://upload.example/s' },
          errors: [],
        })
      )
    )

    await uploadFunctions.getUploadUrl({})
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.requireSignedURLs).toBe(true)
  })

  it('getUploadUrl does not log token or upload URL via any console method', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch.mockResolvedValue(
      textResponse(
        JSON.stringify({
          success: true,
          result: { uid: 'secret-vid', uploadURL: 'https://upload.example/secret-path' },
          errors: [],
        })
      )
    )

    await uploadFunctions.getUploadUrl({})

    const sensitivePatterns = ['secret-path', 'Bearer', process.env.CLOUDFLARE_API_TOKEN].filter(Boolean)
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        const message = JSON.stringify(call)
        for (const pattern of sensitivePatterns) {
          expect(message).not.toContain(pattern)
        }
      }
    }

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('getUploadUrl wraps parse and API failures', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('not-json'))
    await expect(uploadFunctions.getUploadUrl()).rejects.toBeInstanceOf(CloudflareStreamUploadError)

    mockFetch.mockResolvedValueOnce(
      textResponse(JSON.stringify({ success: false, errors: [{ message: 'bad request' }] }), {
        ok: false,
        status: 400,
        statusText: 'Bad',
      })
    )
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/bad request/)

    mockFetch.mockResolvedValueOnce(
      textResponse(JSON.stringify({ success: false, errors: [{ message: 'not success', code: 1 }] }))
    )
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/not success/)
  })

  it('getUploadUrl uses fallback messages when errors array empty', async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse(JSON.stringify({ success: false, errors: [] }), {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      })
    )
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/HTTP 502/)

    mockFetch.mockResolvedValueOnce(
      textResponse(JSON.stringify({ success: false, errors: [] }))
    )
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/Unknown Cloudflare Stream error/)
  })

  it('getUploadUrl wraps network failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/Failed to get upload URL: network down/)

    mockFetch.mockRejectedValueOnce('string-fail')
    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(/Unknown error/)
  })

  it('checkUploadStatus maps stream state to processing status', async () => {
    const cases: Array<{ state: string; status: string; uploaded: boolean; progress: number; error?: string }> = [
      { state: 'ready', status: 'ready', uploaded: true, progress: 100 },
      { state: 'pendingupload', status: 'uploading', uploaded: false, progress: 0 },
      { state: 'downloading', status: 'uploading', uploaded: true, progress: 15 },
      { state: 'queued', status: 'processing', uploaded: true, progress: 5 },
      { state: 'inprogress', status: 'processing', uploaded: true, progress: 40 },
      { state: 'error', status: 'error', uploaded: true, progress: 0, error: 'corrupt' },
      { state: 'unknown-state', status: 'processing', uploaded: true, progress: 10 },
    ]

    for (const c of cases) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: {
            uid: VALID_VIDEO_ID,
            status: {
              state: c.state,
              pctComplete: String(c.progress),
              errorReasonText: c.error,
            },
          },
        })
      )
      const result = await uploadFunctions.checkUploadStatus(VALID_VIDEO_ID)
      expect(result).toMatchObject({
        uid: VALID_VIDEO_ID,
        uploaded: c.uploaded,
        progress: c.progress,
        status: c.status,
        error: c.error,
      })
    }
  })

  it('checkUploadStatus treats invalid pctComplete as 0 and wraps errors', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: {
          uid: VALID_VIDEO_ID,
          status: { state: 'queued', pctComplete: 'not-a-number' },
        },
      })
    )
    expect((await uploadFunctions.checkUploadStatus(VALID_VIDEO_ID)).progress).toBe(0)

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [{ message: 'missing', code: 404 }] }, { ok: false, status: 404, statusText: 'Not Found' })
    )
    await expect(uploadFunctions.checkUploadStatus(VALID_VIDEO_ID_2)).rejects.toBeInstanceOf(CloudflareStreamError)

    mockFetch.mockRejectedValueOnce('raw')
    await expect(uploadFunctions.checkUploadStatus(VALID_VIDEO_ID_3)).rejects.toThrow(/Unknown error/)
  })

  it('uploadVideo uses XHR progress, success, status failure, and network error', async () => {
    type ProgressHandler = ((e: ProgressEvent) => void) | null
    class FakeXHR {
      static instances: FakeXHR[] = []
      upload: { onprogress: ProgressHandler } = { onprogress: null }
      status = 200
      responseText = ''
      statusText = 'OK'
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      open = vi.fn()
      send = vi.fn()
      constructor() {
        FakeXHR.instances.push(this)
      }
    }

    FakeXHR.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest)

    const onProgress = vi.fn()
    const successPromise = uploadFunctions.uploadVideo(new Blob(['x']), 'https://up', onProgress)
    const successXhr = FakeXHR.instances[0]
    successXhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 25,
      total: 100,
    } as ProgressEvent)
    successXhr.upload.onprogress?.({
      lengthComputable: false,
      loaded: 1,
      total: 0,
    } as ProgressEvent)
    successXhr.onload?.()
    await expect(successPromise).resolves.toBeUndefined()
    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(successXhr.open).toHaveBeenCalledWith('POST', 'https://up')

    const failStatusPromise = uploadFunctions.uploadVideo(new Blob(['y']), 'https://up')
    const failXhr = FakeXHR.instances[1]
    failXhr.status = 500
    failXhr.responseText = 'server error'
    failXhr.onload?.()
    await expect(failStatusPromise).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof CloudflareStreamUploadError &&
        /Upload failed with status 500/.test(err.message)
    )

    const networkPromise = uploadFunctions.uploadVideo(new Blob(['z']), 'https://up')
    const netXhr = FakeXHR.instances[2]
    netXhr.statusText = 'Network Error'
    netXhr.onerror?.()
    await expect(networkPromise).rejects.toThrow(/Network error during upload/)
  })

  it('uploadVideo wraps synchronous construction failures', async () => {
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        constructor() {
          throw new Error('xhr unavailable')
        }
      } as unknown as typeof XMLHttpRequest
    )
    await expect(uploadFunctions.uploadVideo(new Blob(['x']), 'https://up')).rejects.toThrow(
      /Failed to upload video: xhr unavailable/
    )

    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        constructor() {
          throw 'weird'
        }
      } as unknown as typeof XMLHttpRequest
    )
    await expect(uploadFunctions.uploadVideo(new Blob(['x']), 'https://up')).rejects.toThrow(
      /Failed to upload video: Unknown error/
    )
  })
})

describe('videoManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  })

  it('rejects invalid video IDs with 400', async () => {
    await expect(videoManagement.getVideoDetails('invalid')).rejects.toThrow(/Invalid video ID format/)
    await expect(videoManagement.getVideoDetails('ABCDEF01234567890ABCDEF012345678')).rejects.toThrow(/Invalid video ID format/)
    await expect(videoManagement.getVideoDetails('abcdef0123456789')).rejects.toThrow(/Invalid video ID format/)
    await expect(videoManagement.getVideoDetails('')).rejects.toThrow(/Invalid video ID format/)
    await expect(videoManagement.getVideoDetails('../etc/passwd')).rejects.toThrow(/Invalid video ID format/)
    
    // Verify 32 lowercase hex is accepted
    const validId = 'abcdef01234567890abcdef012345678'
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: { uid: validId } }))
    await expect(videoManagement.getVideoDetails(validId)).resolves.toBeDefined()
  })

  it('getVideoDetails returns video metadata', async () => {
    const validId = 'abcdef01234567890abcdef012345678'
    const metadata = { uid: validId, status: { state: 'ready', pctComplete: '100' } }
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: metadata }))

    const result = await videoManagement.getVideoDetails(validId)
    expect(result).toEqual(metadata)
  })

  it('getVideoDetails wraps non-Error failures', async () => {
    mockFetch.mockRejectedValueOnce(42)
    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toThrow(/Unknown error/)
  })

  it('updateVideoSettings posts settings and wraps errors', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: {} }))

    await videoManagement.updateVideoSettings(VALID_VIDEO_ID, { requireSignedURLs: true })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/stream/${VALID_VIDEO_ID}`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ requireSignedURLs: true }),
      })
    )

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [{ message: 'settings fail' }] }, { ok: false, status: 400, statusText: 'Bad' })
    )
    await expect(
      videoManagement.updateVideoSettings(VALID_VIDEO_ID, { requireSignedURLs: false })
    ).rejects.toThrow(/Failed to update video settings/)
  })

  it('generateSignedUrl fails closed when signing keys missing', async () => {
    await expect(videoManagement.generateSignedUrl('abcdef01234567890abcdef012345678', 'tier1')).rejects.toThrow(
      /Video signing keys not configured/
    )
  })

  it('generateSignedUrl does not log signing keys or tokens via any console method', async () => {
    const signingKeyId = 'super-secret-key-id'
    const signingKey = 'super-secret-signing-key-value'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = signingKeyId
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = signingKey

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'generated-jwt-token' } }))

    await videoManagement.generateSignedUrl(VALID_VIDEO_ID, 'tier2')

    const sensitivePatterns = [signingKeyId, signingKey, 'generated-jwt-token', process.env.CLOUDFLARE_API_TOKEN].filter(Boolean)
    for (const spy of [logSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        const message = JSON.stringify(call)
        for (const pattern of sensitivePatterns) {
          expect(message).not.toContain(pattern)
        }
      }
    }

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('generateSignedUrl uses token API when signing keys present', async () => {
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'kid'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'secret'
    const validVideoId = 'abcdef01234567890abcdef012345678'
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'jwt-token' } }))

    const hls = await videoManagement.generateSignedUrl(validVideoId, 'tier2', {
      downloadable: true,
      accessRules: [{ type: 'any', action: 'allow' }],
    })
    expect(hls).toContain('token=jwt-token')
    expect(hls).toContain('manifest/video.m3u8')
    const tokenBody = JSON.parse(mockFetch.mock.calls[1][1].body as string)
    expect(tokenBody).toMatchObject({
      sub: validVideoId,
      kid: 'kid',
      downloadable: true,
      accessRules: [{ type: 'any', action: 'allow' }],
    })

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'jwt-2' } }))
    const mp4 = await videoManagement.generateSignedUrl(validVideoId, 'tier3', {}, 'mp4')
    expect(mp4).toContain('downloads/default.mp4?token=jwt-2')
  })

  it('generateSignedUrl applies tier expirations and custom exp/nbf', async () => {
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'kid'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'secret'
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

    for (const tier of ['none', 'tier1', 'tier2', 'tier3'] as const) {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
        .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: `t-${tier}` } }))
      await videoManagement.generateSignedUrl(VALID_VIDEO_ID, tier)
      const body = JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string)
      const now = Math.floor(1_700_000_000_000 / 1000)
      const expectedDelta =
        tier === 'none' ? 30 * 60 : tier === 'tier1' ? 2 * 60 * 60 : tier === 'tier2' ? 8 * 60 * 60 : 24 * 60 * 60
      expect(body.exp).toBe(now + expectedDelta)
      expect(body.nbf).toBe(now)
    }

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'custom' } }))
    await videoManagement.generateSignedUrl(VALID_VIDEO_ID, 'tier1', { exp: 999, nbf: 111 })
    const customBody = JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string)
    expect(customBody.exp).toBe(999)
    expect(customBody.nbf).toBe(111)

    nowSpy.mockRestore()
  })

  it('generateSignedUrl continues when settings fail but signing keys exist', async () => {
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'kid'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'secret'
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ success: false, errors: [{ message: 'settings denied' }] }, { ok: false, status: 400, statusText: 'Bad' })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'still-works' } }))

    const url = await videoManagement.generateSignedUrl('abcdef01234567890abcdef012345678', 'tier1')
    expect(url).toContain('token=still-works')
  })

  it('generateSignedUrl wraps token API failures', async () => {
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'kid'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'secret'
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(
        jsonResponse({ success: false, errors: [{ message: 'token boom' }] }, { ok: false, status: 500, statusText: 'Err' })
      )
    await expect(videoManagement.generateSignedUrl(VALID_VIDEO_ID, 'tier1')).rejects.toThrow(
      /Failed to generate signed URL/
    )

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockRejectedValueOnce('raw-token-fail')
    await expect(videoManagement.generateSignedUrl(VALID_VIDEO_ID, 'tier1')).rejects.toThrow(/Unknown error/)
  })

  it('generateThumbnailUrl builds thumbnail URL with query params', async () => {
    const url = await videoManagement.generateThumbnailUrl(VALID_VIDEO_ID, {
      time: 5,
      width: 320,
      height: 180,
      fit: 'crop',
    })
    expect(url).toContain(`${VALID_VIDEO_ID}/thumbnails/thumbnail.jpg`)
    expect(url).toContain('time=5')
    expect(url).toContain('width=320')
    expect(url).toContain('height=180')
    expect(url).toContain('fit=crop')

    const bare = await videoManagement.generateThumbnailUrl(VALID_VIDEO_ID)
    expect(bare.endsWith('thumbnail.jpg')).toBe(true)
  })

  it('retryProcessing updates metadata unless already ready', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: { uid: VALID_VIDEO_ID, status: { state: 'ready', pctComplete: '100' }, meta: {} },
      })
    )
    await expect(videoManagement.retryProcessing(VALID_VIDEO_ID)).rejects.toThrow(/already processed/)

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: {
            uid: VALID_VIDEO_ID,
            status: { state: 'error', pctComplete: '0' },
            meta: { name: 'x' },
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
    await expect(videoManagement.retryProcessing(VALID_VIDEO_ID)).resolves.toBeUndefined()
    const retryBody = JSON.parse(mockFetch.mock.calls[2][1].body as string)
    expect(retryBody.meta.name).toBe('x')
    expect(retryBody.meta.retry_timestamp).toEqual(expect.any(String))
  })

  it('retryProcessing wraps POST failures', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: { uid: VALID_VIDEO_ID, status: { state: 'error', pctComplete: '0' }, meta: {} },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, errors: [{ message: 'retry denied' }] }, { ok: false, status: 400, statusText: 'Bad' })
      )
    await expect(videoManagement.retryProcessing(VALID_VIDEO_ID)).rejects.toThrow(/Failed to retry processing/)
  })

  it('deleteVideo and updateVideoMetadata succeed and fail', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, result: null }))
    await videoManagement.deleteVideo(VALID_VIDEO_ID)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/stream/${VALID_VIDEO_ID}`),
      expect.objectContaining({ method: 'DELETE' })
    )

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: { uid: VALID_VIDEO_ID, meta: { name: 'N' } },
      })
    )
    const meta = await videoManagement.updateVideoMetadata(VALID_VIDEO_ID, {
      name: 'N',
      requireSignedURLs: true,
      allowedOrigins: ['*'],
      thumbnailTimestampPct: 0.1,
    })
    expect(meta.uid).toBe(VALID_VIDEO_ID)

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: { uid: VALID_VIDEO_ID_2 },
      })
    )
    await videoManagement.updateVideoMetadata(VALID_VIDEO_ID_2, { requireSignedURLs: false })
    const noNameBody = JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string)
    expect(noNameBody.meta).toBeUndefined()

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [{ message: 'delete fail' }] }, { ok: false, status: 500, statusText: 'Err' })
    )
    await expect(videoManagement.deleteVideo(VALID_VIDEO_ID_3)).rejects.toThrow(/Failed to delete video/)

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [{ message: 'meta fail' }] }, { ok: false, status: 500, statusText: 'Err' })
    )
    await expect(videoManagement.updateVideoMetadata(VALID_VIDEO_ID_3, { name: 'x' })).rejects.toThrow(
      /Failed to update video metadata/
    )
  })

  it('throws CloudflareStreamError on API failure via handleStreamResponse', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ success: false, errors: [{ message: 'boom' }] }, { ok: false, status: 500, statusText: 'Server Error' })
    )

    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toBeInstanceOf(CloudflareStreamError)
  })

  it('handleStreamResponse throws when success false with and without error message', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [{ message: 'nope', code: 9 }] })
    )
    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toThrow(/nope/)

    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false, errors: [] }))
    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toThrow(/Unknown Cloudflare Stream error/)

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, errors: [] }, { ok: false, status: 503, statusText: 'Unavailable' })
    )
    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toThrow(/HTTP 503/)
  })
})

describe('webhookHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockVideosClient(handlers: {
    updateByCloudflareId?: () => Promise<{ error: unknown }>
    updateById?: () => Promise<{ error: unknown }>
    single?: () => Promise<{ data: unknown; error: unknown }>
  }) {
    const updateEq = vi.fn((col: string, _val: string) => {
      if (col === 'cloudflare_video_id') {
        return (handlers.updateByCloudflareId ?? (async () => ({ error: null })))()
      }
      return (handlers.updateById ?? (async () => ({ error: null })))()
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: updateEq }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: handlers.single ?? (async () => ({ data: null, error: null })),
          }),
        }),
      }),
    } as never)
    return { updateEq }
  }

  it('processWebhook updates video status and completes when ready', async () => {
    const { updateEq } = mockVideosClient({
      single: async () => ({
        data: { id: 'db-1', title: 'Intro', duration_seconds: 60 },
        error: null,
      }),
    })

    await webhookHandling.processWebhook({
      uid: VALID_VIDEO_ID,
      readyToStream: true,
      status: { state: 'ready', pctComplete: '100' },
      meta: {},
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      duration: 90,
    })

    expect(updateEq).toHaveBeenCalledWith('cloudflare_video_id', VALID_VIDEO_ID)
    expect(updateEq).toHaveBeenCalledWith('id', 'db-1')
  })

  it('processWebhook only updates status when not ready to stream', async () => {
    const updateByCloudflareId = vi.fn().mockResolvedValue({ error: null })
    const single = vi.fn()
    mockVideosClient({
      updateByCloudflareId,
      single,
    })

    await webhookHandling.processWebhook({
      uid: VALID_VIDEO_ID,
      readyToStream: false,
      status: { state: 'queued', pctComplete: '10' },
      meta: {},
      created: '',
      modified: '',
    })

    expect(updateByCloudflareId).toHaveBeenCalled()
    expect(single).not.toHaveBeenCalled()
  })

  it('processWebhook only updates status when readyToStream but state not ready', async () => {
    const updateByCloudflareId = vi.fn().mockResolvedValue({ error: null })
    const single = vi.fn()
    mockVideosClient({ updateByCloudflareId, single })

    await webhookHandling.processWebhook({
      uid: VALID_VIDEO_ID,
      readyToStream: true,
      status: { state: 'inprogress', pctComplete: '50' },
      meta: {},
      created: '',
      modified: '',
      duration: 12.6,
    })

    expect(updateByCloudflareId).toHaveBeenCalled()
    expect(single).not.toHaveBeenCalled()
  })

  it('processWebhook throws when uid missing', async () => {
    await expect(
      webhookHandling.processWebhook({
        uid: '',
        readyToStream: false,
        status: { state: 'queued', pctComplete: '0' },
        meta: {},
        created: '',
        modified: '',
      })
    ).rejects.toThrow(/Failed to process webhook.*Invalid webhook payload/)
  })

  it('updateVideoStatus wraps supabase update errors', async () => {
    mockVideosClient({
      updateByCloudflareId: async () => ({ error: { message: 'db write failed' } }),
    })

    await expect(
      webhookHandling.updateVideoStatus(VALID_VIDEO_ID, {
        uid: VALID_VIDEO_ID,
        readyToStream: false,
        status: { state: 'error', pctComplete: '0' },
        meta: {},
        created: '',
        modified: '',
      })
    ).rejects.toThrow(/Failed to update video status in database/)
  })

  it('handleProcessingComplete returns early when video missing', async () => {
    mockVideosClient({
      single: async () => ({ data: null, error: null }),
    })

    await expect(
      webhookHandling.handleProcessingComplete(VALID_VIDEO_ID, {
        uid: VALID_VIDEO_ID,
        readyToStream: true,
        status: { state: 'ready', pctComplete: '100' },
        meta: {},
        created: '',
        modified: '',
      })
    ).resolves.toBeUndefined()
  })

  it('handleProcessingComplete wraps fetch and update errors', async () => {
    mockVideosClient({
      single: async () => ({ data: null, error: { message: 'fetch failed' } }),
    })
    await expect(
      webhookHandling.handleProcessingComplete(VALID_VIDEO_ID, {
        uid: VALID_VIDEO_ID,
        readyToStream: true,
        status: { state: 'ready', pctComplete: '100' },
        meta: {},
        created: '',
        modified: '',
      })
    ).rejects.toThrow(/Failed to handle processing complete/)

    mockVideosClient({
      single: async () => ({
        data: { id: 'db-2', title: 'T', duration_seconds: 10 },
        error: null,
      }),
      updateById: async () => ({ error: { message: 'final update failed' } }),
    })
    await expect(
      webhookHandling.handleProcessingComplete(VALID_VIDEO_ID_2, {
        uid: VALID_VIDEO_ID_2,
        readyToStream: true,
        status: { state: 'ready', pctComplete: '100' },
        meta: {},
        created: '',
        modified: '',
      })
    ).rejects.toThrow(/Failed to handle processing complete/)
  })

  it('handleProcessingComplete keeps existing duration when payload has none', async () => {
    const updateById = vi.fn().mockResolvedValue({ error: null })
    mockVideosClient({
      single: async () => ({
        data: { id: 'db-3', title: 'Keep', duration_seconds: 42 },
        error: null,
      }),
      updateById,
    })

    await webhookHandling.handleProcessingComplete(VALID_VIDEO_ID_3, {
      uid: VALID_VIDEO_ID_3,
      readyToStream: true,
      status: { state: 'ready', pctComplete: '100' },
      meta: {},
      created: '',
      modified: '',
    })

    expect(updateById).toHaveBeenCalled()
  })

  it('logs in development for webhook errors, missing video, and completion', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(
      webhookHandling.processWebhook({
        uid: '',
        readyToStream: false,
        status: { state: 'queued', pctComplete: '0' },
        meta: {},
        created: '',
        modified: '',
      })
    ).rejects.toThrow(/Invalid webhook payload/)
    expect(errorSpy).toHaveBeenCalled()

    mockVideosClient({
      single: async () => ({ data: null, error: null }),
    })
    await webhookHandling.handleProcessingComplete(VALID_VIDEO_ID, {
      uid: VALID_VIDEO_ID,
      readyToStream: true,
      status: { state: 'ready', pctComplete: '100' },
      meta: {},
      created: '',
      modified: '',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(VALID_VIDEO_ID))

    mockVideosClient({
      single: async () => ({
        data: { id: 'db-dev', title: 'Dev Title', duration_seconds: 5 },
        error: null,
      }),
    })
    await webhookHandling.handleProcessingComplete(VALID_VIDEO_ID_2, {
      uid: VALID_VIDEO_ID_2,
      readyToStream: true,
      status: { state: 'ready', pctComplete: '100' },
      meta: {},
      created: '',
      modified: '',
      duration: 8.2,
    })
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dev Title'))

    errorSpy.mockRestore()
    warnSpy.mockRestore()
    logSpy.mockRestore()
    vi.unstubAllEnvs()
  })
})

describe('securityFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  })

  it('validateVideoAccess respects tier hierarchy', async () => {
    expect(await securityFunctions.validateVideoAccess('tier2', 'tier1')).toBe(true)
    expect(await securityFunctions.validateVideoAccess('tier1', 'tier2')).toBe(false)
    expect(await securityFunctions.validateVideoAccess('tier3', 'tier3')).toBe(true)
    expect(await securityFunctions.validateVideoAccess('none', 'none')).toBe(true)
    expect(await securityFunctions.validateVideoAccess(null, 'tier1')).toBe(false)
  })

  it('validateWebhookSignature returns true (stub) for all arg combinations', () => {
    expect(securityFunctions.validateWebhookSignature('a', 'b', 'c')).toBe(true)
    expect(securityFunctions.validateWebhookSignature('', 'b', 'c')).toBe(true)
    expect(securityFunctions.validateWebhookSignature('a', '', 'c')).toBe(true)

    vi.stubEnv('NODE_ENV', 'development')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(securityFunctions.validateWebhookSignature('payload', 'sig', 'secret')).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not implemented'))
    warnSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('generateAdminPreviewUrl fails closed without signing keys', async () => {
    await expect(securityFunctions.generateAdminPreviewUrl(VALID_VIDEO_ID)).rejects.toThrow(
      /Video signing keys not configured/
    )
  })

  it('generateAdminPreviewUrl uses token path when signing keys set', async () => {
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = 'kid'
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'secret'
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, result: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: { token: 'admin-jwt' } }))

    const url = await securityFunctions.generateAdminPreviewUrl(VALID_VIDEO_ID)
    expect(url).toContain('token=admin-jwt')
    expect(url).toContain(VALID_VIDEO_ID)
  })
})

describe('cloudflareStreamService export', () => {
  it('exposes upload/video/webhook/security and default export', () => {
    expect(cloudflareStreamService.upload).toBe(uploadFunctions)
    expect(cloudflareStreamService.video).toBe(videoManagement)
    expect(cloudflareStreamService.webhook).toBe(webhookHandling)
    expect(cloudflareStreamService.security).toBe(securityFunctions)
    expect(cloudflareStreamServiceDefault).toBe(cloudflareStreamService)
  })
})

describe('server-only API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('throws when Cloudflare Stream helpers detect a browser window', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    })

    await expect(uploadFunctions.getUploadUrl()).rejects.toThrow(
      /Cloudflare Stream API can only be used on server-side/
    )
    await expect(videoManagement.getVideoDetails(VALID_VIDEO_ID)).rejects.toThrow(
      /Cloudflare Stream API can only be used on server-side/
    )
    await expect(videoManagement.updateVideoSettings(VALID_VIDEO_ID, {})).rejects.toThrow(
      /Cloudflare Stream API can only be used on server-side/
    )
  })
})

describe('env validation', () => {
  it('imports without env but rejects API calls when Cloudflare env vars are missing', async () => {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID
    const token = process.env.CLOUDFLARE_API_TOKEN

    const env = process.env as Record<string, string | undefined>
    delete env.CLOUDFLARE_ACCOUNT_ID
    delete env.CLOUDFLARE_API_TOKEN

    try {
      // Env access is lazy (Workers only guarantees env at request time),
      // so importing succeeds and the failure surfaces on first API call.
      await expect(uploadFunctions.getUploadUrl({})).rejects.toThrow(
        /Missing Cloudflare environment variables/
      )
    } finally {
      process.env.CLOUDFLARE_ACCOUNT_ID = account
      process.env.CLOUDFLARE_API_TOKEN = token
    }
  })
})
