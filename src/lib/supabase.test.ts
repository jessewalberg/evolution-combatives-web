/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ssrBrowserClient = vi.fn(() => ({ kind: 'browser' }))
const ssrServerClient = vi.fn(() => ({ kind: 'server' }))
const createClient = vi.fn(() => ({ kind: 'admin' }))
const getCookies = vi.fn(() => ({ 'sb-auth': 'token' }))
const setCookie = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => (ssrBrowserClient as (...a: unknown[]) => unknown)(...args),
  createServerClient: (...args: unknown[]) => (ssrServerClient as (...a: unknown[]) => unknown)(...args),
  parseCookieHeader: (header: string) =>
    header
      ? header.split('; ').map((part) => {
          const [name, ...rest] = part.split('=')
          return { name, value: rest.join('=') }
        })
      : [],
  serializeCookieHeader: (name: string, value: string) => `${name}=${value}`,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => (createClient as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getCookies: (...args: unknown[]) => (getCookies as (...a: unknown[]) => unknown)(...args),
  setCookie: (...args: unknown[]) => (setCookie as (...a: unknown[]) => unknown)(...args),
}))

type CookieAdapter = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>
    setAll: (cookies: Array<{ name: string; value: string; options?: object }>) => void
  }
}

describe('supabase clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('createBrowserClient builds an SSR browser client with url and anon key', async () => {
    const { createBrowserClient } = await import('./supabase')
    expect(createBrowserClient()).toEqual({ kind: 'browser' })
    expect(ssrBrowserClient).toHaveBeenCalledWith('https://test.supabase.co', 'anon-key')
  })

  it('createServerClient wires cookies through the Start request context', async () => {
    const { createServerClient } = await import('./supabase')
    await expect(createServerClient()).resolves.toEqual({ kind: 'server' })

    const adapter = (ssrServerClient.mock.calls[0] as unknown[])[2] as CookieAdapter
    expect(adapter.cookies.getAll()).toEqual([{ name: 'sb-auth', value: 'token' }])

    adapter.cookies.setAll([{ name: 'sb-auth', value: 'refreshed', options: { path: '/' } }])
    expect(setCookie).toHaveBeenCalledWith('sb-auth', 'refreshed', { path: '/' })
  })

  it('createMiddlewareClient reads request cookies and collects Set-Cookie headers', async () => {
    const { createMiddlewareClient } = await import('./supabase')
    const request = new Request('https://example.com/dashboard', {
      headers: { cookie: 'sb-auth=token' },
    })

    const { supabase, cookieHeaders } = createMiddlewareClient(request)
    expect(supabase).toEqual({ kind: 'server' })

    const adapter = (ssrServerClient.mock.calls[0] as unknown[])[2] as CookieAdapter
    expect(adapter.cookies.getAll()).toEqual([{ name: 'sb-auth', value: 'token' }])

    adapter.cookies.setAll([{ name: 'sb-auth', value: 'refreshed' }])
    expect(cookieHeaders.getSetCookie()).toEqual(['sb-auth=refreshed'])
  })

  it('createAdminClient throws in browser', async () => {
    vi.stubGlobal('window', {})
    const { createAdminClient } = await import('./supabase')
    expect(() => createAdminClient()).toThrow(/cannot be used in browser/)
  })

  it('createAdminClient throws when service role key missing', async () => {
    const prev = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    // @ts-expect-error test cleanup
    delete globalThis.window

    const { createAdminClient } = await import('./supabase')
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)

    process.env.SUPABASE_SERVICE_ROLE_KEY = prev
  })

  it('createAdminClient builds service-role client on server', async () => {
    // @ts-expect-error ensure server
    delete globalThis.window
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'

    const { createAdminClient } = await import('./supabase')
    expect(createAdminClient()).toEqual({ kind: 'admin' })
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role',
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      })
    )
  })
})
