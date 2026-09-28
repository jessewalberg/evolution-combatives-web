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

vi.mock('@/src/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
  getOrCreateCustomer: vi.fn(),
}))

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'

const mockCreateCheckoutSession = vi.mocked(createCheckoutSession)
const mockGetOrCreateCustomer = vi.mocked(getOrCreateCustomer)

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
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_1' } as never)
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/cs',
      amount_total: 1900,
      currency: 'usd',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    } as never)
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
    mockSubscriptionSingle.mockResolvedValue({
      data: { id: 'sub-row-1', status: 'past_due', tier: 'tier1' },
      error: null,
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already has a subscription in progress')
    expect(body.currentStatus).toBe('past_due')
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('blocks the upgradeFromTier path too when a non-terminal subscription already exists', async () => {
    mockSubscriptionSingle.mockResolvedValue({
      data: { id: 'sub-row-1', status: 'active', tier: 'tier1' },
      error: null,
    })

    const res = (await POST(mobileRequest({ tier: 'tier2', upgradeFromTier: 'tier1' })))!

    expect(res.status).toBe(400)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('fails closed (500) when the subscription lookup itself errors', async () => {
    mockSubscriptionSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST500', message: 'connection reset' },
    })

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Unable to verify subscription status')
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
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
      price: 19,
      currency: 'usd',
    })
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith('user@test.com', 'user-1')
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_runtime_tier2' })
    )
  })

  it('rejects a missing tier price before creating a Stripe customer', async () => {
    vi.stubEnv('STRIPE_INTERMEDIATE_PRICE_ID', '')

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Price ID not configured for tier: tier2')
    expect(mockGetOrCreateCustomer).not.toHaveBeenCalled()
  })

  it('returns 500 when stripe throws stripe-named error', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('stripe api error'))

    const res = (await POST(mobileRequest({ tier: 'tier2' })))!
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Payment processing error')
  })

  it('returns 500 for generic errors', async () => {
    mockGetOrCreateCustomer.mockRejectedValue(new Error('customer fail'))

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
