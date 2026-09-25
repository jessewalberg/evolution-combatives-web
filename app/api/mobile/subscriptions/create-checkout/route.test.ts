import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

const mockAuthenticateMobileBearer = vi.fn()
vi.mock('../../../../../src/lib/mobile-auth', () => ({
  authenticateMobileBearer: (...args: unknown[]) => mockAuthenticateMobileBearer(...args),
}))

const mockCreateCheckoutSession = vi.fn()
const mockGetOrCreateCustomer = vi.fn()
const mockRetrieveSubscription = vi.fn()
const mockCreatePortalSession = vi.fn()
vi.mock('../../../../../src/lib/stripe', () => ({
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  getOrCreateCustomer: (...args: unknown[]) => mockGetOrCreateCustomer(...args),
  stripe: {
    subscriptions: { retrieve: (...args: unknown[]) => mockRetrieveSubscription(...args) },
    billingPortal: { sessions: { create: (...args: unknown[]) => mockCreatePortalSession(...args) } },
  },
}))

import { POST } from './route'

const fakeSupabase = createFakeSupabaseClient()
const stripeSubscription = {
  id: 'sub_server_owned',
  status: 'active',
  customer: 'cus_server_owned',
  items: { data: [{ id: 'si_1', quantity: 1 }] },
}

function mobileRequest(body: Record<string, unknown>) {
  return createNextRequest('/api/mobile/subscriptions/create-checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer valid-token' },
  })
}

function queueCurrentSubscription(data: Record<string, unknown> | null) {
  fakeSupabase.queueResult({ data, error: null })
}

describe('POST /api/mobile/subscriptions/create-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeSupabase.reset()
    mockAuthenticateMobileBearer.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        supabase: fakeSupabase,
      },
    })
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_new' })
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/cs_1',
      amount_total: 2900,
      currency: 'usd',
      expires_at: 1_800_000_000,
    })
    mockRetrieveSubscription.mockResolvedValue(stripeSubscription)
    mockCreatePortalSession.mockResolvedValue({
      id: 'bps_1',
      url: 'https://billing.stripe.com/session/1',
    })
  })

  it('returns the reusable bearer helper error before billing work', async () => {
    mockAuthenticateMobileBearer.mockResolvedValue({
      error: Response.json({ success: false, error: 'Invalid token' }, { status: 401 }),
    })

    const response = await POST(mobileRequest({ tier: 'tier2' }))
    expect(response.status).toBe(401)
    expect(fakeSupabase.from).not.toHaveBeenCalled()
  })

  it('rejects the free tier and all client-provided ownership claims', async () => {
    const free = await POST(mobileRequest({ tier: 'none' }))
    expect(free.status).toBe(400)

    const ownershipClaim = await POST(
      mobileRequest({
        tier: 'tier2',
        upgradeFromTier: 'tier1',
        stripeSubscriptionId: 'sub_attacker_selected',
      })
    )
    expect(ownershipClaim.status).toBe(400)
    expect(fakeSupabase.from).not.toHaveBeenCalled()
  })

  it('rejects untrusted Stripe redirect URLs', async () => {
    const response = await POST(
      mobileRequest({ tier: 'tier2', successUrl: 'https://attacker.example/steal' })
    )
    expect(response.status).toBe(400)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('requires an authenticated email address', async () => {
    mockAuthenticateMobileBearer.mockResolvedValue({
      data: { user: { id: 'user-1', email: null }, supabase: fakeSupabase },
    })
    const response = await POST(mobileRequest({ tier: 'tier1' }))
    expect(response.status).toBe(400)
  })

  it('fails closed when current subscription state cannot be loaded', async () => {
    fakeSupabase.queueResult({ data: null, error: { message: 'db down' } })
    const response = await POST(mobileRequest({ tier: 'tier2' }))
    expect(response.status).toBe(500)
    expect(mockGetOrCreateCustomer).not.toHaveBeenCalled()
  })

  it('creates a first-time checkout from authenticated user data', async () => {
    queueCurrentSubscription(null)
    const response = await POST(
      mobileRequest({
        tier: 'tier2',
        successUrl: 'evolutioncombatives://subscription/success?tier=tier2',
        cancelUrl: 'evolutioncombatives://subscription/cancel',
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      sessionId: 'cs_1',
      url: 'https://checkout.stripe.com/cs_1',
      tier: 'tier2',
      mode: 'checkout',
    })
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith('user@example.com', 'user-1')
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_new',
      priceId: 'price_test_tier2',
      userId: 'user-1',
      tier: 'tier2',
      successUrl: 'evolutioncombatives://subscription/success?tier=tier2',
      cancelUrl: 'evolutioncombatives://subscription/cancel',
    })
  })

  it('rejects same-tier and downgrade requests using the database tier', async () => {
    queueCurrentSubscription({ tier: 'tier2', status: 'active' })
    const sameTier = await POST(mobileRequest({ tier: 'tier2' }))
    expect(sameTier.status).toBe(409)

    fakeSupabase.reset()
    queueCurrentSubscription({ tier: 'tier3', status: 'active' })
    const downgrade = await POST(mobileRequest({ tier: 'tier1' }))
    expect(downgrade.status).toBe(409)
    expect(mockRetrieveSubscription).not.toHaveBeenCalled()
  })

  it('does not move a non-Stripe subscription into a Stripe checkout', async () => {
    queueCurrentSubscription({
      tier: 'tier1',
      status: 'active',
      platform: 'revenuecat',
      external_subscription_id: 'rc_1',
    })

    const response = await POST(mobileRequest({ tier: 'tier2' }))
    expect(response.status).toBe(409)
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('creates an update-confirm portal from server-owned subscription IDs', async () => {
    queueCurrentSubscription({
      tier: 'tier1',
      status: 'active',
      platform: 'stripe',
      stripe_subscription_id: 'sub_server_owned',
      stripe_customer_id: 'cus_server_owned',
      external_subscription_id: 'sub_server_owned',
    })

    const response = await POST(mobileRequest({ tier: 'tier3' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({
      sessionId: 'bps_1',
      tier: 'tier3',
      mode: 'subscription_update',
    })
    expect(mockRetrieveSubscription).toHaveBeenCalledWith('sub_server_owned')
    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_server_owned',
        flow_data: expect.objectContaining({
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: 'sub_server_owned',
            items: [{ id: 'si_1', price: 'price_test_tier3', quantity: 1 }],
          },
        }),
      })
    )
  })

  it('rejects a Stripe customer mismatch instead of trusting stale ownership', async () => {
    queueCurrentSubscription({
      tier: 'tier1',
      platform: 'stripe',
      stripe_subscription_id: 'sub_server_owned',
      stripe_customer_id: 'cus_database_owner',
    })

    const response = await POST(mobileRequest({ tier: 'tier2' }))
    expect(response.status).toBe(409)
    expect(mockCreatePortalSession).not.toHaveBeenCalled()
  })

  it('masks payment-provider failures', async () => {
    queueCurrentSubscription(null)
    mockCreateCheckoutSession.mockRejectedValue(new Error('secret provider detail'))

    const response = await POST(mobileRequest({ tier: 'tier1' }))
    const body = await response.json()
    expect(response.status).toBe(502)
    expect(body.error).not.toContain('secret provider detail')
  })
})
