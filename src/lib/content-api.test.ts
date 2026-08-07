/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContentApiClient } from './content-api'

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

describe('ContentApiClient', () => {
  let client: ContentApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    client = new ContentApiClient()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createVideo fetches CSRF then posts create action', async () => {
    const video = { id: 'v1', title: 'Intro' }
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'csrf-1',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: video }))

    const result = await client.createVideo(video as never)
    expect(result).toEqual(video)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/csrf-token',
      expect.objectContaining({ credentials: 'include' })
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/content/videos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-1' }),
      })
    )
  })

  it('reuses cached CSRF token within expiry', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'csrf-cached',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'v1' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'v1', title: 'U' } }))

    await client.createVideo({ id: 'v1' } as never)
    await client.updateVideo('v1', { title: 'U' } as never)

    const csrfCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/csrf-token')
    expect(csrfCalls).toHaveLength(1)
  })

  it('throws when CSRF endpoint is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
      text: async () => '',
    })

    await expect(client.createVideo({} as never)).rejects.toThrow(/Failed to fetch CSRF token/)
  })

  it('throws when CSRF response missing token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false }))

    await expect(client.createVideo({} as never)).rejects.toThrow(/Failed to get CSRF token/)
  })

  it('retries once after CSRF validation failure then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'old',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'CSRF token validation failed' })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'fresh',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'v1' } }))

    const result = await client.createVideo({ id: 'v1' } as never)
    expect(result).toEqual({ id: 'v1' })
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('throws on API error after successful CSRF', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'csrf',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'Video not found' }))

    await expect(client.updateVideo('missing', {})).rejects.toThrow('Video not found')
  })

  it('throws on non-JSON API response', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          csrfToken: 'csrf',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '<html>oops</html>',
        json: async () => {
          throw new Error('not json')
        },
      })

    await expect(client.createVideo({} as never)).rejects.toThrow(/non-JSON response/)
  })

  it('fetchCategories and fetchDisciplines use GET endpoints', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [{ id: 'c1' }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [{ id: 'd1' }] }))

    await expect(client.fetchCategories()).resolves.toEqual([{ id: 'c1' }])
    await expect(client.fetchDisciplines()).resolves.toEqual([{ id: 'd1' }])

    expect(mockFetch).toHaveBeenCalledWith('/api/content/categories', expect.objectContaining({ method: 'GET' }))
    expect(mockFetch).toHaveBeenCalledWith('/api/content/disciplines', expect.objectContaining({ method: 'GET' }))
  })

  it('throws when GET request fails', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Unauthorized' }))
    await expect(client.fetchCategories()).rejects.toThrow('Unauthorized')
  })
})
