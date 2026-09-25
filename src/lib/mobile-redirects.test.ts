import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAllowedMobileRedirect, mobileDeepLink } from './mobile-redirects'

describe('mobile redirect allowlist', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_MOBILE_APP_SCHEME', 'evolutioncombatives')
    vi.stubEnv('MOBILE_APP_SCHEMES', '')
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows the configured app deep-link scheme', () => {
    vi.stubEnv('NEXT_PUBLIC_MOBILE_APP_SCHEME', 'custom-app://')
    expect(isAllowedMobileRedirect('custom-app://subscription/success')).toBe(true)
    expect(mobileDeepLink('/subscription/cancel')).toBe('custom-app://subscription/cancel')
  })

  it('allows every shipped mobile build variant and explicit additions', () => {
    for (const scheme of [
      'evolutioncombatives',
      'evolutioncombatives-dev',
      'evolutioncombatives-staging',
      'evolutioncombatives-preview',
      'evolutioncombatives-testflight',
    ]) {
      expect(isAllowedMobileRedirect(`${scheme}://subscription/success`)).toBe(true)
    }

    vi.stubEnv('MOBILE_APP_SCHEMES', 'partner-app, second-app://')
    expect(isAllowedMobileRedirect('partner-app://subscription/success')).toBe(true)
    expect(isAllowedMobileRedirect('second-app://subscription/cancel')).toBe(true)
  })

  it('allows owned production and configured HTTPS hosts', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
    expect(isAllowedMobileRedirect('https://www.evolutioncombatives.com/done')).toBe(true)
    expect(isAllowedMobileRedirect('https://testing.evolutioncombatives.com/done')).toBe(true)
    expect(isAllowedMobileRedirect('https://app.example.com/done')).toBe(true)
  })

  it('ignores invalid configured origins', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not a url')
    expect(isAllowedMobileRedirect('https://attacker.example/done')).toBe(false)
  })

  it('allows local HTTP only outside production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(isAllowedMobileRedirect('http://localhost:3000/done')).toBe(true)
    expect(isAllowedMobileRedirect('http://127.0.0.1:3000/done')).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    expect(isAllowedMobileRedirect('http://localhost:3000/done')).toBe(false)
  })

  it('rejects invalid, unowned, and insecure URLs', () => {
    expect(isAllowedMobileRedirect('not a URL')).toBe(false)
    expect(isAllowedMobileRedirect('https://attacker.example/done')).toBe(false)
    expect(isAllowedMobileRedirect('http://www.evolutioncombatives.com/done')).toBe(false)
  })
})
