/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClient = { from: vi.fn() }
const ssrBrowserClient = vi.fn(() => mockClient)

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) =>
    (ssrBrowserClient as (...a: unknown[]) => typeof mockClient)(...args),
  createServerClient: vi.fn(),
  parseCookieHeader: vi.fn(() => []),
  serializeCookieHeader: vi.fn(),
}))

describe('supabase-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  })

  it('createBrowserClient returns the SSR browser client', async () => {
    const mod = await import('./supabase-browser')
    const client = mod.createBrowserClient()
    expect(client).toBe(mockClient)
    expect(ssrBrowserClient).toHaveBeenCalledWith('https://test.supabase.co', 'anon-key')
  })

  it('exports default supabase singleton and re-exports helper', async () => {
    const mod = await import('./supabase-browser')
    expect(mod.supabase).toBe(mockClient)
    expect(typeof mod.createClientComponentClient).toBe('function')
    expect(mod.createClientComponentClient()).toBe(mockClient)
  })

  it('reuses the same browser client instance (singleton)', async () => {
    const mod = await import('./supabase-browser')
    const a = mod.createBrowserClient()
    const b = mod.createBrowserClient()
    expect(a).toBe(b)
  })
})
