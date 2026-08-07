import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Stub env vars required by modules that throw at import time
process.env.STRIPE_SECRET_KEY ??= 'sk_test_fake_key_for_vitest'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_fake_secret_for_vitest'
process.env.CLOUDFLARE_ACCOUNT_ID ??= 'test-cloudflare-account-id'
process.env.CLOUDFLARE_API_TOKEN ??= 'test-cloudflare-api-token'
process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN ??= 'customer-test-subdomain'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.STRIPE_BEGINNER_PRICE_ID ??= 'price_test_tier1'
process.env.STRIPE_INTERMEDIATE_PRICE_ID ??= 'price_test_tier2'
process.env.STRIPE_ADVANCED_PRICE_ID ??= 'price_test_tier3'
process.env.NEXT_PUBLIC_MOBILE_APP_SCHEME ??= 'evolutioncombatives'
process.env.CLOUDFLARE_WEBHOOK_SECRET ??= 'test-cloudflare-webhook-secret'
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true,
  enumerable: true,
})

// Ensure fetch exists for stubbing per-test
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn()
}

// Headless UI (Menu/Popover) uses ResizeObserver; jsdom does not provide it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as typeof ResizeObserver)
