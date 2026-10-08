import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

describe('ingest proxy path validation', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', mockFetch)
  })

  async function callProxy(pathname: string, method = 'GET') {
    const mod = await import('./ingest.$')
    const request = new Request(`http://localhost${pathname}`, { method })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    return handlers[method]({ request })
  }

  it('keeps double-slash paths on the analytics origin', async () => {
    const res = await callProxy('/ingest//other.host/x')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects /ingest/\\other.host (backslash)', async () => {
    const res = await callProxy('/ingest/\\other.host')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects /ingest///other.host (triple slash)', async () => {
    const res = await callProxy('/ingest///other.host')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects /ingest/%2F%2Fother.host (encoded double slash)', async () => {
    const res = await callProxy('/ingest/%2F%2Fother.host')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects /ingest/%5Cother.host (encoded backslash)', async () => {
    const res = await callProxy('/ingest/%5Cother.host')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects /ingest/path%5Cwith%5Cbackslash (encoded backslash in path)', async () => {
    const res = await callProxy('/ingest/path%5Cwith%5Cbackslash')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('proxies normal path /ingest/batch to PostHog origin', async () => {
    const res = await callProxy('/ingest/batch', 'POST')
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://us.i.posthog.com/batch')
  })

  it('proxies /ingest/static/file.js to assets origin', async () => {
    const res = await callProxy('/ingest/static/file.js')
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://us-assets.i.posthog.com/static/file.js')
  })

  it('preserves query string in proxy', async () => {
    const res = await callProxy('/ingest/decide?v=3&ip=1')
    expect(res.status).toBe(200)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://us.i.posthog.com/decide?v=3&ip=1')
  })

  it('uses redirect: manual in fetch options', async () => {
    await callProxy('/ingest/batch', 'POST')
    const [, options] = mockFetch.mock.calls[0]
    expect(options.redirect).toBe('manual')
  })

  it('strips cookie header from outbound request', async () => {
    vi.resetModules()
    const mod = await import('./ingest.$')
    const request = new Request('http://localhost/ingest/batch', {
      method: 'POST',
      headers: { cookie: 'session=abc123' },
    })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    await handlers.POST({ request })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.get('cookie')).toBeNull()
  })

  it('strips set-cookie header from response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', {
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'set-cookie': 'session=xyz; HttpOnly',
        }),
      })
    )
    const res = await callProxy('/ingest/batch', 'POST')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('strips hop-by-hop headers from request', async () => {
    vi.resetModules()
    const mod = await import('./ingest.$')
    const request = new Request('http://localhost/ingest/batch', {
      method: 'POST',
      headers: {
        connection: 'keep-alive',
        'transfer-encoding': 'chunked',
        'content-type': 'application/json',
      },
    })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    await handlers.POST({ request })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.get('connection')).toBeNull()
    expect(options.headers.get('transfer-encoding')).toBeNull()
    expect(options.headers.get('content-type')).toBe('application/json')
  })

  it('strips hop-by-hop headers from response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', {
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          connection: 'close',
          'keep-alive': 'timeout=5',
        }),
      })
    )
    const res = await callProxy('/ingest/batch', 'POST')
    expect(res.headers.get('connection')).toBeNull()
    expect(res.headers.get('keep-alive')).toBeNull()
    expect(res.headers.get('content-type')).toBe('application/json')
  })

  it('strips authorization header from outbound request', async () => {
    vi.resetModules()
    const mod = await import('./ingest.$')
    const request = new Request('http://localhost/ingest/batch', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
    })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    await handlers.POST({ request })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.get('authorization')).toBeNull()
    expect(options.headers.get('content-type')).toBe('application/json')
  })

  it('strips x-csrf-token header from outbound request', async () => {
    vi.resetModules()
    const mod = await import('./ingest.$')
    const request = new Request('http://localhost/ingest/batch', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-secret',
        'content-type': 'application/json',
      },
    })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    await handlers.POST({ request })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.get('x-csrf-token')).toBeNull()
    expect(options.headers.get('content-type')).toBe('application/json')
  })

  it('rejects invalid percent-encoding in path', async () => {
    const res = await callProxy('/ingest/batch%ZZ')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
