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

  it('rejects paths with leading double-slash', async () => {
    const res = await callProxy('/ingest//example.org/x')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects paths with leading backslash', async () => {
    const res = await callProxy('/ingest/\\example.org')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects paths with triple slash', async () => {
    const res = await callProxy('/ingest///example.org')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects encoded double slash', async () => {
    const res = await callProxy('/ingest/%2F%2Fexample.org')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects encoded backslash', async () => {
    const res = await callProxy('/ingest/%5Cexample.org')
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

  it('forwards only allowed request headers', async () => {
    vi.resetModules()
    const mod = await import('./ingest.$')
    const request = new Request('http://localhost/ingest/batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'user-agent': 'TestAgent',
        'cookie': 'session=abc123',
        'authorization': 'Bearer secret',
        'x-csrf-token': 'csrf-value',
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8',
        'cf-access-client-id': 'access-id',
      },
    })
    const handlers = mod.Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>
    await handlers.POST({ request })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.get('content-type')).toBe('application/json')
    expect(options.headers.get('accept')).toBe('application/json')
    expect(options.headers.get('user-agent')).toBe('TestAgent')
    expect(options.headers.get('cookie')).toBeNull()
    expect(options.headers.get('authorization')).toBeNull()
    expect(options.headers.get('x-csrf-token')).toBeNull()
    expect(options.headers.get('cf-connecting-ip')).toBeNull()
    expect(options.headers.get('x-forwarded-for')).toBeNull()
    expect(options.headers.get('cf-access-client-id')).toBeNull()
  })

  it('forwards only allowed response headers', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', {
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'cache-control': 'no-cache',
          'vary': 'Accept-Encoding',
          'set-cookie': 'session=xyz; HttpOnly',
          'access-control-allow-origin': '*',
          'connection': 'close',
          'keep-alive': 'timeout=5',
        }),
      })
    )
    const res = await callProxy('/ingest/batch', 'POST')
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('vary')).toBe('Accept-Encoding')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.headers.get('connection')).toBeNull()
    expect(res.headers.get('keep-alive')).toBeNull()
  })

  it('rejects invalid percent-encoding in path', async () => {
    const res = await callProxy('/ingest/batch%ZZ')
    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
