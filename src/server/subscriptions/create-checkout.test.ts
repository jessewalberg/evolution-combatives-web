import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler, GET } from './create-checkout'
const POST = (request: Request): Promise<Response> => POSTHandler({ request } as never)

const mockValidateSessionAuth = vi.fn()

vi.mock('@/src/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
  getOrCreateCustomer: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/src/lib/api-auth', () => ({
  validateSessionAuth: () => mockValidateSessionAuth(),
}))

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'

const mockCreateCheckoutSession = vi.mocked(createCheckoutSession)
const mockGetOrCreateCustomer = vi.mocked(getOrCreateCustomer)
const mockCreateAdminClient = vi.mocked(createAdminClient)

const validUserId = '11111111-1111-4111-8111-111111111111'
const validEmail = 'user@example.com'

function makeAuthSuccess(userId: string, email: string) {
  return {
    user: { userId, email },
  }
}

function makeAuthError(status: number, errorMsg: string) {
  return {
    error: new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  }
}

function buildSupabase(options: {
  existingSubscription?: { id: string; status: string; tier: string } | null
}) {
  const subscriptionsSingle = vi.fn().mockResolvedValue({
    data: options.existingSubscription ?? null,
    error: null,
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: subscriptionsSingle }),
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

describe('POST /api/subscriptions/create-checkout (web session auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateSessionAuth.mockResolvedValue(makeAuthSuccess(validUserId, validEmail))
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' } as never)
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/session',
      customer_details: { email: validEmail },
    } as never)
    mockCreateAdminClient.mockReturnValue(buildSupabase({}) as never)
  })

  it('returns 401 when not authenticated (no session)', async () => {
    mockValidateSessionAuth.mockResolvedValue(makeAuthError(401, 'Authentication required'))

    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: 'tier1' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Authentication required')
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

  it('returns 400 when user already has active subscription', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({
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
    expect(body.error).toBe('User already has an active subscription')
    expect(body.currentTier).toBe('tier1')
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

  it('creates checkout session on success with session-derived user', async () => {
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
    // User identity comes from session, not request body
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(validEmail, validUserId)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_test_tier1',
        customerId: 'cus_123',
        userId: validUserId,
        tier: 'tier1',
      })
    )
  })

  it('ignores userId/userEmail in request body - uses session only', async () => {
    // Even if attacker sends different userId in body, session user is used
    const attackerUserId = '22222222-2222-4222-8222-222222222222'
    const res = await POST(
      createNextRequest('/api/subscriptions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ 
          tier: 'tier1',
          userId: attackerUserId,
          userEmail: 'attacker@example.com'
        }),
      })
    )
    
    expect(res.status).toBe(200)
    // Should use session user, not body values
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(validEmail, validUserId)
  })
})
