import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

const mockAuthenticateMobileBearer = vi.fn()
vi.mock('../../../../../src/lib/mobile-auth', () => ({
  authenticateMobileBearer: (...args: unknown[]) => mockAuthenticateMobileBearer(...args),
}))

const mockCreatePortalSession = vi.fn()
vi.mock('../../../../../src/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: { create: (...args: unknown[]) => mockCreatePortalSession(...args) },
    },
  },
}))

import { POST } from './route'

const fakeSupabase = createFakeSupabaseClient()

function portalRequest(body: Record<string, unknown>) {
  return createNextRequest('/api/mobile/subscriptions/portal', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer valid-token' },
  })
}

describe('POST /api/mobile/subscriptions/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeSupabase.reset()
    mockAuthenticateMobileBearer.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        supabase: fakeSupabase,
      },
    })
    mockCreatePortalSession.mockResolvedValue({
      id: 'bps_1',
      url: 'https://billing.stripe.com/session/1',
    })
  })

  it('returns the reusable bearer helper error', async () => {
    mockAuthenticateMobileBearer.mockResolvedValue({
      error: Response.json({ success: false, error: 'Invalid token' }, { status: 401 }),
    })
    const response = await POST(portalRequest({}))
    expect(response.status).toBe(401)
    expect(fakeSupabase.from).not.toHaveBeenCalled()
  })

  it('rejects untrusted return URLs and extra ownership fields', async () => {
    const untrusted = await POST(
      portalRequest({ returnUrl: 'https://attacker.example/return' })
    )
    expect(untrusted.status).toBe(400)

    const ownershipClaim = await POST(
      portalRequest({ stripeCustomerId: 'cus_attacker_selected' })
    )
    expect(ownershipClaim.status).toBe(400)
  })

  it('fails closed on a billing lookup error', async () => {
    fakeSupabase.queueResult({ data: null, error: { message: 'db unavailable' } })
    const response = await POST(portalRequest({}))
    expect(response.status).toBe(500)
    expect(mockCreatePortalSession).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller has no Stripe customer record', async () => {
    fakeSupabase.queueResult({ data: null, error: null })
    const response = await POST(portalRequest({}))
    expect(response.status).toBe(404)
  })

  it('creates a portal only for the customer resolved from the caller row', async () => {
    fakeSupabase.queueResult({
      data: { stripe_customer_id: 'cus_server_owned', created_at: '2026-01-01' },
      error: null,
    })

    const response = await POST(
      portalRequest({ returnUrl: 'evolutioncombatives://subscription/cancel' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({
      sessionId: 'bps_1',
      url: 'https://billing.stripe.com/session/1',
    })
    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customer: 'cus_server_owned',
      return_url: 'evolutioncombatives://subscription/cancel',
    })
    expect(fakeSupabase.calls[0].filters).toEqual(
      expect.arrayContaining([
        { type: 'eq', args: ['user_id', 'user-1'] },
        { type: 'eq', args: ['platform', 'stripe'] },
      ])
    )
  })

  it('masks portal provider failures', async () => {
    fakeSupabase.queueResult({
      data: { stripe_customer_id: 'cus_server_owned' },
      error: null,
    })
    mockCreatePortalSession.mockRejectedValue(new Error('provider secret detail'))

    const response = await POST(portalRequest({}))
    const body = await response.json()
    expect(response.status).toBe(502)
    expect(body.error).not.toContain('provider secret detail')
  })
})
