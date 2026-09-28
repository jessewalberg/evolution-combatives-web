import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route } from './ingest.$'

type Method = 'GET' | 'POST' | 'OPTIONS'
type Handler = (args: { request: Request }) => Promise<Response>

const handlers = (Route.options as unknown as { server: { handlers: Record<Method, Handler> } }).server.handlers

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('PostHog ingest proxy', () => {
  it.each(['GET', 'POST', 'OPTIONS'] as const)('keeps %s ingest requests on the configured origin', async (method) => {
    vi.stubEnv('POSTHOG_HOST', 'https://posthog.internal.test:8443')
    const fetchMock = vi.fn().mockResolvedValue(new Response('proxied', { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await handlers[method]({
      request: new Request('https://app.test/ingest/e?event=one', {
        method, headers: { cookie: 'secret=1' }, body: method === 'POST' ? 'payload' : undefined,
      }),
    })

    expect(response.status).toBe(202)
    expect(await response.text()).toBe('proxied')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [destination, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(destination).toBe('https://posthog.internal.test:8443/e?event=one')
    expect(init.method).toBe(method)
    expect(init.redirect).toBe('manual')
    expect(new Headers(init.headers).get('host')).toBe('posthog.internal.test:8443')
    expect(new Headers(init.headers).has('cookie')).toBe(false)
  })

  it.each(['GET', 'POST', 'OPTIONS'] as const)('keeps %s URL-shaped paths on the PostHog origin', async (method) => {
    vi.stubEnv('POSTHOG_HOST', 'https://us.i.posthog.com')
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('proxied', { status: 202 })))
    vi.stubGlobal('fetch', fetchMock)

    for (const suffix of [
      '//example.org/x',
      '/%2F%2Fexample.org/x',
      '/%5C%5Cexample.org/x',
      '/\\\\example.org/x',
      '/https://example.org/x',
      '/http:%2F%2Fexample.org/x',
    ]) {
      await handlers[method]({
        request: new Request(`https://app.test/ingest${suffix}?event=one`, {
          method, body: method === 'POST' ? 'payload' : undefined,
        }),
      })
      const [destination, init] = fetchMock.mock.lastCall as [string, RequestInit]
      const target = new URL(destination)
      expect(target.origin, suffix).toBe('https://us.i.posthog.com')
      expect(target.search, suffix).toBe('?event=one')
      expect(init.redirect, suffix).toBe('manual')
    }
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('routes static assets to the fixed asset origin', async () => {
    vi.stubEnv('POSTHOG_HOST', 'https://posthog.internal.test')
    const fetchMock = vi.fn().mockResolvedValue(new Response('asset'))
    vi.stubGlobal('fetch', fetchMock)

    await handlers.GET({ request: new Request('https://app.test/ingest/static/app.js?v=2') })

    expect(fetchMock.mock.calls[0][0]).toBe('https://us-assets.i.posthog.com/static/app.js?v=2')
  })
})
