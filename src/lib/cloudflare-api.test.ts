/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CloudflareApiClient } from './cloudflare-api'

const mockFetch = vi.fn()

function jsonResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('CloudflareApiClient', () => {
  let client: CloudflareApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    client = new CloudflareApiClient()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockCsrf(token = 'csrf-token') {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        csrfToken: token,
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      })
    )
  }

  it('getUploadUrl posts action with CSRF header', async () => {
    mockCsrf()
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { uploadUrl: 'https://up', videoId: 'vid-1' } })
    )

    const result = await client.getUploadUrl({ maxDurationSeconds: 600 })
    expect(result).toEqual({ uploadUrl: 'https://up', videoId: 'vid-1' })
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/cloudflare/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token' }),
      })
    )
  })

  it('throws when CSRF fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
      text: async () => '',
    })
    await expect(client.getUploadUrl()).rejects.toThrow(/Failed to fetch CSRF token/)
  })

  it('throws when CSRF payload invalid', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await expect(client.getUploadUrl()).rejects.toThrow(/Failed to get CSRF token/)
  })

  it('retries after CSRF validation failure', async () => {
    mockCsrf('stale')
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'CSRF token validation failed' })
    )
    mockCsrf('fresh')
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { uploadUrl: 'u', videoId: 'v' } })
    )

    await expect(client.getUploadUrl()).resolves.toEqual({ uploadUrl: 'u', videoId: 'v' })
  })

  it('throws on API failure', async () => {
    mockCsrf()
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Upload denied' }))
    await expect(client.getUploadUrl()).rejects.toThrow('Upload denied')
  })

  it('throws on non-JSON response', async () => {
    mockCsrf()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'not-json',
      json: async () => {
        throw new Error('bad')
      },
    })
    await expect(client.getUploadUrl()).rejects.toThrow(/non-JSON response/)
  })

  it('checkUploadStatus / generateAdminPreviewUrl / generateThumbnailUrl / retryProcessing', async () => {
    // CSRF is cached on the client after the first successful fetch
    mockCsrf()
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { status: 'ready' } }))
    await expect(client.checkUploadStatus('vid')).resolves.toEqual({ status: 'ready' })

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { previewUrl: 'https://preview' } })
    )
    await expect(client.generateAdminPreviewUrl('vid')).resolves.toBe('https://preview')

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { thumbnailUrl: 'https://thumb' } })
    )
    await expect(client.generateThumbnailUrl('vid', { width: 320 })).resolves.toBe('https://thumb')

    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: null }))
    await expect(client.retryProcessing('vid')).resolves.toBeUndefined()
  })

  it('uploadVideo resolves on 2xx and rejects on error/abort', async () => {
    class FakeXHR {
      static instances: FakeXHR[] = []
      upload = { onprogress: null as ((e: ProgressEvent) => void) | null }
      status = 200
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
      open = vi.fn()
      send = vi.fn(() => {
        queueMicrotask(() => this.onload?.())
      })
      abort = vi.fn(() => {
        this.onabort?.()
      })
      constructor() {
        FakeXHR.instances.push(this)
      }
    }

    vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest)

    const onProgress = vi.fn()
    const file = new Blob(['x'], { type: 'video/mp4' })
    const done = client.uploadVideo(file, 'https://upload.example', onProgress)
    const xhr = FakeXHR.instances[0]
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent)
    await expect(done).resolves.toBeUndefined()
    expect(onProgress).toHaveBeenCalledWith(50)

    // failure status
    FakeXHR.instances.length = 0
    const failPromise = client.uploadVideo(file, 'https://upload.example')
    FakeXHR.instances[0].status = 500
    await expect(failPromise).rejects.toThrow(/Upload failed/)

    // abort via signal
    FakeXHR.instances.length = 0
    const controller = new AbortController()
    const abortPromise = client.uploadVideo(file, 'https://upload.example', undefined, controller.signal)
    controller.abort()
    await expect(abortPromise).rejects.toThrow(/Upload cancelled/)
  })
})
