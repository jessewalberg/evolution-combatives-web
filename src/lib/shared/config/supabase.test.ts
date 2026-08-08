import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('supabase shared config', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('validateSupabaseConfig succeeds with valid env', async () => {
    const { validateSupabaseConfig } = await import('@/src/lib/shared/config/supabase')
    expect(validateSupabaseConfig()).toBe(true)
  })

  it('validateSupabaseConfig throws when URL missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.EXPO_PUBLIC_SUPABASE_URL
    vi.resetModules()
    const { validateSupabaseConfig } = await import('@/src/lib/shared/config/supabase')
    expect(() => validateSupabaseConfig()).toThrow(/Missing Supabase URL/)
  })

  it('validateSupabaseConfig throws when anon key missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    vi.resetModules()
    const { validateSupabaseConfig } = await import('@/src/lib/shared/config/supabase')
    expect(() => validateSupabaseConfig()).toThrow(/Missing Supabase anon key/)
  })

  it('validateSupabaseConfig throws on invalid URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
    vi.resetModules()
    const { validateSupabaseConfig } = await import('@/src/lib/shared/config/supabase')
    expect(() => validateSupabaseConfig()).toThrow(/Invalid Supabase URL/)
  })

  it('platformConfigs override detectSessionInUrl appropriately', async () => {
    const { platformConfigs } = await import('@/src/lib/shared/config/supabase')
    expect(platformConfigs.reactNative.auth.detectSessionInUrl).toBe(false)
    expect(platformConfigs.nextjsBrowser.auth.detectSessionInUrl).toBe(true)
    expect(platformConfigs.nextjsServer.auth.detectSessionInUrl).toBe(false)
    expect(platformConfigs.admin.auth.persistSession).toBe(false)
  })

  it('environmentConfig exposes timeouts and flags', async () => {
    const { environmentConfig } = await import('@/src/lib/shared/config/supabase')
    expect(environmentConfig.defaultTimeout).toBe(30000)
    expect(environmentConfig.uploadTimeout).toBe(300000)
    expect(environmentConfig.realtimeHeartbeatInterval).toBe(30000)
    expect(typeof environmentConfig.isTest).toBe('boolean')
  })
})
