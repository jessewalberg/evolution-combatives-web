import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './subscriptions-create-checkout'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()
const mockSubscriptionSingle = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({ single: mockSubscriptionSingle }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockProfileSingle }),
        }),
      }
    }),
  })),
}))

vi.mock('@/src/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/supabase')>()
  return {
    ...actual,
    createAdminClient: vi.fn(() => ({})),
  }
})

vi.mock('@/src/server/subscriptions/checkout-flow', () => ({
  assertSingleNonTerminalSubscription: vi.fn(),
  createReservedCheckoutSession: vi.fn(),
}))

import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from '@/src/server/subscriptions/checkout-flow'

const mockAssertSubscription = vi.mocked(assertSingleNonTerminalSubscription)
const mockCreateReservedCheckoutSession = vi.mocked(createReservedCheckoutSession)

function mobileRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return createNextRequest('/api/mobile/subscriptions/create-checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer valid-token',
      'X-Mobile-Client': 'EvolutionCombatives',
      'User-Agent': 'EvolutionCombatives-Mobile/1.0',
      ...headers,
    },
  })
}

describe('POST /api/mobile/subscriptions/create-checkout', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key')
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@test.com' } },
      error: null,
    })
    mockProfileSingle.mockResolvedValue({
      data: { id: 'user-1', email: 'user@test.com', subscription_tier: 'tier1' },
      error: null,
    })
    mockSubscriptionSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    mockAssertSubscription.mockResolvedValue({ ok: true })
    mockCreateReservedCheckoutSession.mockResolvedValue({
      ok: true,
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.com/cs',
      expiresAt: '2030-01-01T00:00:00.000Z',
      reused: false,
    })
  })

  it('returns 401 without bearer token', async () => {
    const res = (await POST(
      createNextRequest('/api/mobile/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier2' }),
      })
    ))!
    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Bearer token')
  })

  it('returns 401 for invalid token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' },
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid authentication token')
  })

  it('returns 401 when profile missing', async () => {
    mockProfileSingle.mockResolvedValue({ data: null, error: { message: 'missing' } })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('User profile not found')
  })

  it('returns 400 for invalid upgrade direction', async () => {
    const res = (await POST(
      mobileRequest({ tier: 'tier1', upgradeFromTier: 'tier2' })
    ))!
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid upgrade')
  })

  it('returns 400 when the user already has a non-terminal subscription', async () => {
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'User already has a subscription in progress',
      currentStatus: 'past_due',
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already has a subscription in progress')
    expect(body.currentStatus).toBe('past_due')
    expect(mockCreateReservedCheckoutSession).not.toHaveBeenCalled()
  })

  it('blocks the upgradeFromTier path too when a non-terminal subscription already exists', async () => {
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'User already has a subscription in progress',
      currentStatus: 'active',
    })

    const res = (await POST(mobileRequest({ tier: 'tier2', upgradeFromTier: 'tier1' })))!

    expect(res.status).toBe(400)
    expect(mockCreateReservedCheckoutSession).not.toHaveBeenCalled()
  })

  it('fails closed (500) when the subscription lookup itself errors', async () => {
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Unable to verify subscription status',
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Unable to verify subscription status')
    expect(mockCreateReservedCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid request schema', async () => {
    const res = (await POST(mobileRequest({ tier: 'invalid' })))!
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid request data')
  })

  it('creates checkout session successfully', async () => {
    vi.stubEnv('STRIPE_INTERMEDIATE_PRICE_ID', 'price_runtime_tier2')
    const res = (await POST(
      mobileRequest({
        tier: 'tier2',
        upgradeFromTier: 'tier1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })
    ))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.com/cs',
      tier: 'tier2',
      price: 29,
      currency: 'usd',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    expect(mockCreateReservedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tier: 'tier2', priceId: 'price_runtime_tier2' })
    )
  })

  it('returns the stored expiry for a reused checkout session', async () => {
    mockCreateReservedCheckoutSession.mockResolvedValue({
      ok: true,
      sessionId: 'cs_reused',
      url: 'https://checkout.stripe.com/reused',
      expiresAt: '2026-09-28T12:05:00.000Z',
      reused: true,
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    expect(res.status).toBe(200)
    expect((await res.json()).data.expiresAt).toBe('2026-09-28T12:05:00.000Z')
  })

  it('rejects a missing tier price before creating a Stripe customer', async () => {
    vi.stubEnv('STRIPE_INTERMEDIATE_PRICE_ID', '')

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Price ID not configured for tier: tier2')
    expect(mockCreateReservedCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns 500 when stripe throws stripe-named error', async () => {
    mockCreateReservedCheckoutSession.mockResolvedValue({ ok: false, status: 500, error: 'Payment processing error' })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Payment processing error')
  })

  it('returns 500 for generic errors', async () => {
    mockCreateReservedCheckoutSession.mockRejectedValue(new Error('checkout fail'))

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to create checkout session')
  })

  it('returns 500 when auth client throws', async () => {
    mockGetUser.mockRejectedValue(new Error('auth crash'))

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Authentication failed')
  })
})
