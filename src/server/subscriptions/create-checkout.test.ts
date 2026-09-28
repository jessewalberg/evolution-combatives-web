import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler, GET } from './create-checkout'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/session-auth', () => ({
  requireAuthenticatedSession: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('./checkout-flow', () => ({
  assertSingleNonTerminalSubscription: vi.fn(),
  createReservedCheckoutSession: vi.fn(),
}))

import { requireAuthenticatedSession } from '@/src/lib/session-auth'
import { createServerClient } from '@/src/lib/supabase'
import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from './checkout-flow'

const mockRequireAuthenticatedSession = vi.mocked(requireAuthenticatedSession)
const mockCreateServerClient = vi.mocked(createServerClient)
const mockAssertSubscription = vi.mocked(assertSingleNonTerminalSubscription)
const mockCreateReservedCheckoutSession = vi.mocked(createReservedCheckoutSession)

const validUserId = '11111111-1111-4111-8111-111111111111'
const otherUserId = '22222222-2222-4222-8222-222222222222'
const validEmail = 'user@example.com'

function buildSupabase(options: {
  user?: { id: string; email: string } | null
  userError?: boolean
}) {
  const profilesSingle = vi.fn().mockResolvedValue({
    data: options.user ?? null,
    error: options.userError ? { message: 'not found' } : null,
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
    mockRequireAuthenticatedSession.mockResolvedValue({
      userId: validUserId,
      email: validEmail,
    })
    mockCreateServerClient.mockResolvedValue(
      buildSupabase({ user: { id: validUserId, email: validEmail } }) as never
    )
    mockAssertSubscription.mockResolvedValue({ ok: true })
    mockCreateReservedCheckoutSession.mockResolvedValue({
      ok: true,
      sessionId: 'cs_123',
      url: 'https://checkout.stripe.com/session',
      expiresAt: '2030-01-01T00:00:00.000Z',
      reused: false,
    })
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
    expect(mockCreateReservedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: validUserId, userEmail: validEmail, tier: 'tier1' })
    )
  })

  it('returns 400 when user already has active subscription', async () => {
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'User already has a subscription in progress',
      currentTier: 'tier1',
      currentStatus: 'active',
    })

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
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'User already has a subscription in progress',
      currentStatus: 'past_due',
    })

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
    mockAssertSubscription.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Unable to verify subscription status',
    })

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Unable to verify subscription status')
    expect(mockCreateReservedCheckoutSession).not.toHaveBeenCalled()
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
    expect(mockCreateReservedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: validUserId,
        tier: 'tier1',
        priceId: 'price_runtime_tier1',
      })
    )
  })
})
