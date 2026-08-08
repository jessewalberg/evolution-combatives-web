/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createClientComponentClient = vi.fn(() => ({ kind: 'browser' }))
const createServerComponentClient = vi.fn(() => ({ kind: 'server' }))
const createMiddlewareClientHelper = vi.fn(() => ({ kind: 'middleware' }))
const createClient = vi.fn(() => ({ kind: 'admin' }))

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: (...args: unknown[]) =>
    (createClientComponentClient as (...a: unknown[]) => unknown)(...args),
  createServerComponentClient: (...args: unknown[]) =>
    (createServerComponentClient as (...a: unknown[]) => unknown)(...args),
  createMiddlewareClient: (...args: unknown[]) =>
    (createMiddlewareClientHelper as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => (createClient as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}))

describe('supabase clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createBrowserClient uses createClientComponentClient', async () => {
    const { createBrowserClient } = await import('./supabase')
    expect(createBrowserClient()).toEqual({ kind: 'browser' })
    expect(createClientComponentClient).toHaveBeenCalled()
  })

  it('createServerClient and createServerComponentClient pass cookies', async () => {
    const { createServerClient, createServerComponentClient: createSCC } = await import('./supabase')
    await expect(createServerClient()).resolves.toEqual({ kind: 'server' })
    await expect(createSCC()).resolves.toEqual({ kind: 'server' })
    expect(createServerComponentClient).toHaveBeenCalledWith(
      expect.objectContaining({ cookies: expect.any(Function) })
    )
  })

  it('createMiddlewareClient forwards req/res', async () => {
    const { createMiddlewareClient } = await import('./supabase')
    const req = { url: 'https://example.com' } as never
    const res = { cookies: {} } as never
    expect(createMiddlewareClient(req, res)).toEqual({ kind: 'middleware' })
    expect(createMiddlewareClientHelper).toHaveBeenCalledWith({ req, res })
  })

  it('createAdminClient throws in browser', async () => {
    vi.stubGlobal('window', {})
    const { createAdminClient } = await import('./supabase')
    expect(() => createAdminClient()).toThrow(/cannot be used in browser/)
  })

  it('createAdminClient throws when service role key missing', async () => {
    const prev = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    // Ensure no window
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'

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
