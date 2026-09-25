/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockClient: { from: vi.fn() },
  createSupabaseBrowserClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) =>
    (mocks.createSupabaseBrowserClient as (...values: unknown[]) => unknown)(...args),
}))

describe('supabase-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    mocks.createSupabaseBrowserClient.mockReturnValue(mocks.mockClient)
  })

  it('creates its singleton with the SSR browser cookie client', async () => {
    const mod = await import('./supabase-browser')

    expect(mod.supabase).toBe(mocks.mockClient)
    expect(mocks.createSupabaseBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'anon-key'
    )
  })

  it('preserves both browser factory names for existing callers', async () => {
    const mod = await import('./supabase-browser')

    expect(mod.createBrowserClient()).toBe(mocks.mockClient)
    expect(mod.createClientComponentClient()).toBe(mocks.mockClient)
    expect(mocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(3)
  })
})
