/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClient = { from: vi.fn() }
const createClientComponentClient = vi.fn(() => mockClient)

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: (...args: unknown[]) =>
    (createClientComponentClient as (...a: unknown[]) => typeof mockClient)(...args),
}))

describe('supabase-browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('createBrowserClient returns typed client component client', async () => {
    const mod = await import('./supabase-browser')
    const client = mod.createBrowserClient()
    expect(client).toBe(mockClient)
    expect(createClientComponentClient).toHaveBeenCalled()
  })

  it('exports default supabase singleton and re-exports helper', async () => {
    const mod = await import('./supabase-browser')
    expect(mod.supabase).toBe(mockClient)
    expect(typeof mod.createClientComponentClient).toBe('function')
    expect(mod.createClientComponentClient()).toBe(mockClient)
  })
})
