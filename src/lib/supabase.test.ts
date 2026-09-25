/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  createSupabaseBrowserClient: vi.fn((..._args: unknown[]) => ({ kind: 'browser' })),
  createSupabaseServerClient: vi.fn((..._args: unknown[]) => ({ kind: 'server' })),
  createClient: vi.fn((..._args: unknown[]) => ({ kind: 'admin' })),
  cookies: vi.fn(),
  cookieGetAll: vi.fn(),
  cookieSet: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) =>
    (mocks.createSupabaseBrowserClient as (...values: unknown[]) => unknown)(...args),
  createServerClient: (...args: unknown[]) =>
    (mocks.createSupabaseServerClient as (...values: unknown[]) => unknown)(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) =>
    (mocks.createClient as (...values: unknown[]) => unknown)(...args),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

type SsrCookieOptions = {
  cookies: {
    getAll: () => unknown
    setAll: (cookies: CookieToSet[]) => void
  }
}

function latestSsrCookieOptions(): SsrCookieOptions {
  const call = mocks.createSupabaseServerClient.mock.calls.at(-1)
  if (!call) {
    throw new Error('Expected the Supabase server client to be created')
  }
  return call[2] as SsrCookieOptions
}

describe('supabase clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    mocks.cookieGetAll.mockReturnValue([{ name: 'existing', value: 'cookie' }])
    mocks.cookies.mockResolvedValue({
      getAll: mocks.cookieGetAll,
      set: mocks.cookieSet,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the browser compatibility factories on the SSR cookie client', async () => {
    const { createBrowserClient, createClientComponentClient } = await import('./supabase')

    expect(createBrowserClient()).toEqual({ kind: 'browser' })
    expect(createClientComponentClient()).toEqual({ kind: 'browser' })
    expect(mocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(2)
    expect(mocks.createSupabaseBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'anon-key'
    )
  })

  it('uses the async Next 15 cookie store for both server compatibility factories', async () => {
    const { createServerClient, createServerComponentClient } = await import('./supabase')

    await expect(createServerClient()).resolves.toEqual({ kind: 'server' })
    let cookieOptions = latestSsrCookieOptions()
    expect(cookieOptions.cookies.getAll()).toEqual([{ name: 'existing', value: 'cookie' }])

    const cookie = {
      name: 'sb-auth-token',
      value: 'refreshed',
      options: { httpOnly: true },
    }
    cookieOptions.cookies.setAll([cookie])
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      cookie.name,
      cookie.value,
      cookie.options
    )

    await expect(createServerComponentClient()).resolves.toEqual({ kind: 'server' })
    cookieOptions = latestSsrCookieOptions()
    expect(cookieOptions.cookies.getAll()).toEqual([{ name: 'existing', value: 'cookie' }])
    expect(mocks.cookies).toHaveBeenCalledTimes(2)
    expect(mocks.createSupabaseServerClient).toHaveBeenLastCalledWith(
      'https://test.supabase.co',
      'anon-key',
      expect.objectContaining({ cookies: expect.any(Object) })
    )
  })

  it('tolerates read-only cookies in a Server Component', async () => {
    mocks.cookieSet.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler')
    })

    const { createServerClient } = await import('./supabase')
    await createServerClient()

    expect(() => latestSsrCookieOptions().cookies.setAll([
      { name: 'sb-auth-token', value: 'refreshed' },
    ])).not.toThrow()
  })

  it('propagates middleware refresh cookies to the request and replacement response', async () => {
    const { createMiddlewareClient } = await import('./supabase')
    const request = new NextRequest('https://example.com/dashboard', {
      headers: { cookie: 'existing=cookie' },
    })
    const response = NextResponse.next()
    response.headers.set('X-Frame-Options', 'DENY')
    let updatedResponse: NextResponse | undefined

    expect(createMiddlewareClient(
      request,
      response,
      (nextResponse) => { updatedResponse = nextResponse }
    )).toEqual({ kind: 'server' })

    expect(latestSsrCookieOptions().cookies.getAll()).toEqual([
      expect.objectContaining({ name: 'existing', value: 'cookie' }),
    ])
    latestSsrCookieOptions().cookies.setAll([{
      name: 'sb-auth-token',
      value: 'refreshed',
      options: { httpOnly: true, sameSite: 'lax' },
    }])

    expect(request.cookies.get('sb-auth-token')?.value).toBe('refreshed')
    expect(response.cookies.get('sb-auth-token')?.value).toBe('refreshed')
    expect(updatedResponse?.cookies.get('sb-auth-token')?.value).toBe('refreshed')
    expect(updatedResponse?.headers.get('X-Frame-Options')).toBe('DENY')
    expect(updatedResponse?.headers.get('x-middleware-request-cookie')).toContain(
      'sb-auth-token=refreshed'
    )
    expect(updatedResponse?.headers.get('x-middleware-override-headers')).toContain('cookie')
  })

  it('still writes response cookies when a legacy middleware caller omits the callback', async () => {
    const { createMiddlewareClient } = await import('./supabase')
    const request = new NextRequest('https://example.com/dashboard')
    const response = NextResponse.next()

    createMiddlewareClient(request, response)
    latestSsrCookieOptions().cookies.setAll([
      { name: 'sb-auth-token', value: 'refreshed' },
    ])

    expect(request.cookies.get('sb-auth-token')?.value).toBe('refreshed')
    expect(response.cookies.get('sb-auth-token')?.value).toBe('refreshed')
  })

  it('createAdminClient throws in browser', async () => {
    vi.stubGlobal('window', {})
    const { createAdminClient } = await import('./supabase')
    expect(() => createAdminClient()).toThrow(/cannot be used in browser/)
  })

  it('createAdminClient throws when service role key missing', async () => {
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    // @ts-expect-error test cleanup emulates the server runtime
    delete globalThis.window

    const { createAdminClient } = await import('./supabase')
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)

    process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey
  })

  it('createAdminClient builds service-role client on server', async () => {
    // @ts-expect-error test cleanup emulates the server runtime
    delete globalThis.window
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'

    const { createAdminClient } = await import('./supabase')
    expect(createAdminClient()).toEqual({ kind: 'admin' })
    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role',
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      })
    )
  })
})
