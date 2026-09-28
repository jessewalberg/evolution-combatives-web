import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler, GET } from './create-checkout'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
  getOrCreateCustomer: vi.fn(),
}))

vi.mock('@/src/lib/session-auth', () => ({
  requireAuthenticatedSession: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'
import { requireAuthenticatedSession } from '@/src/lib/session-auth'
import { createServerClient } from '@/src/lib/supabase'

const mockCreateCheckoutSession = vi.mocked(createCheckoutSession)
const mockGetOrCreateCustomer = vi.mocked(getOrCreateCustomer)
const mockRequireAuthenticatedSession = vi.mocked(requireAuthenticatedSession)
const mockCreateServerClient = vi.mocked(createServerClient)

const validUserId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const validEmail = 'user@example.com'

function buildSupabase(options: {
  user?: { id: string; email: string } | null
  userError?: boolean
  existingSubscription?: { id: string; status: string; tier: string } | null
  existingSubscriptionError?: { code: string; message: string } | null
}) {
  const profilesSingle = vi.fn().mockResolvedValue({
    data: options.user ?? null,
    error: options.userError ? { message: 'not found' } : null,
  })
  const subscriptionsSingle = vi.fn().mockResolvedValue({
    data: options.existingSubscription ?? null,
    error: options.existingSubscriptionError ?? null,
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: profilesSingle }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({ single: subscriptionsSingle }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('GET /api/subscriptions/create-checkout', () => {
  it('returns health check', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

describe('POST /api/subscriptions/create-checkout', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' } as never)
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/session',
      customer_details: { email: validEmail },
    } as never)
    mockRequireAuthenticatedSession.mockResolvedValue({
      userId: validUserId,
      email: validEmail,
    })
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({ user: { id: validUserId, email: validEmail } }) as never
    )
  })

  it('returns 401 when there is no authenticated session', async () => {
    mockRequireAuthenticatedSession.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    })

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )

    expect(res.status).toBe(401)
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid request data', async () => {
    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'invalid' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid request data')
    expect(body.details).toBeDefined()
  })

  it('returns 401 when profile for session user is missing', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({ user: null, userError: true }) as never
    )

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('User not found or not authenticated')
  })

  it('ignores spoofed userId in body and uses the authenticated session user', async () => {
    vi.stubEnv('STRIPE_BEGINNER_PRICE_ID', 'price_runtime_tier1')

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          tier: 'tier1',
          userId: otherUserId,
          userEmail: 'attacker@example.com',
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(validEmail, validUserId)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: validUserId })
    )
  })

  it('returns 400 when user already has active subscription', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({
        user: { id: validUserId, email: validEmail },
        existingSubscription: { id: 'sub1', status: 'active', tier: 'tier1' },
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier2' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already has a subscription in progress')
    expect(body.currentTier).toBe('tier1')
  })

  it('blocks checkout while an existing subscription is past_due, not just active', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({
        user: { id: validUserId, email: validEmail },
        existingSubscription: { id: 'sub1', status: 'past_due', tier: 'tier2' },
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('User already has a subscription in progress')
    expect(body.currentStatus).toBe('past_due')
  })

  it('fails closed (500) when the existing-subscription lookup itself errors', async () => {
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({
        user: { id: validUserId, email: validEmail },
        existingSubscriptionError: { code: 'PGRST500', message: 'connection reset' },
      }) as never
    )

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Unable to verify subscription status')
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns 500 when priceId missing for none tier', async () => {
    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'none' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Price ID not configured for tier: none')
  })

  it('creates checkout session on success', async () => {
    vi.stubEnv('STRIPE_BEGINNER_PRICE_ID', 'price_runtime_tier1')

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      sessionId: 'cs_123',
      url: 'https://checkout.stripe.com/session',
      tier: 'tier1',
      price: 19,
    })
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(validEmail, validUserId)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_runtime_tier1',
        customerId: 'cus_123',
        userId: validUserId,
        tier: 'tier1',
      })
    )
  })
})
