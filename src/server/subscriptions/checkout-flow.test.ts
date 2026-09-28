import { describe, it, expect, vi } from 'vitest'
import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from './checkout-flow'
import { createAdminClient } from '@/src/lib/supabase'
import { createCheckoutSession, getOrCreateCustomer, stripe } from '@/src/lib/stripe'

vi.mock('@/src/lib/supabase', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/src/lib/stripe', () => ({
  createCheckoutSession: vi.fn(),
  getOrCreateCustomer: vi.fn(),
  stripe: { checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } } },
}))

const mockCreateAdminClient = vi.mocked(createAdminClient)

function mockOrphans(result: { count: number | null; error: unknown }) {
  const is = vi.fn().mockResolvedValue(result)
  mockCreateAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ is }),
        }),
      }),
    }),
  } as never)
  return is
}

function mockSupabase(result: { data: unknown[] | null; error: unknown; count: number | null }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue(result),
        }),
      }),
    })),
  } as never
}

describe('assertSingleNonTerminalSubscription', () => {
  it('blocks an unresolved paid orphan after the live subscription is canceled', async () => {
    const supabase = mockSupabase({ data: [], error: null, count: 0 })
    const is = mockOrphans({ count: 1, error: null })

    expect(await assertSingleNonTerminalSubscription(supabase, 'user-1')).toEqual({
      ok: false, status: 400, error: 'Unresolved payment requires review',
    })
    expect(is).toHaveBeenCalledWith('resolved_at', null)
  })

  it('fails closed when orphan lookup fails and allows a resolved payment', async () => {
    const supabase = mockSupabase({ data: [], error: null, count: 0 })
    mockOrphans({ count: null, error: { message: 'lookup failed' } })
    expect(await assertSingleNonTerminalSubscription(supabase, 'user-1')).toEqual({
      ok: false, status: 500, error: 'Unable to verify subscription status',
    })

    mockOrphans({ count: 0, error: null })
    expect(await assertSingleNonTerminalSubscription(supabase, 'user-1')).toEqual({ ok: true })
  })

  it('fails closed when more than one non-terminal row is returned', async () => {
    const supabase = mockSupabase({
      data: [
        { id: 'a', status: 'active', tier: 'tier1' },
        { id: 'b', status: 'past_due', tier: 'tier2' },
      ],
      error: null,
      count: 2,
    })

    const result = await assertSingleNonTerminalSubscription(supabase, 'user-1')
    expect(result).toEqual({ ok: false, status: 500, error: 'Unable to verify subscription status' })
  })

  it('fails closed when the row list and count disagree', async () => {
    for (const count of [null, 1]) {
      const supabase = mockSupabase({ data: [], error: null, count })
      expect(await assertSingleNonTerminalSubscription(supabase, 'user-1')).toEqual({
        ok: false, status: 500, error: 'Unable to verify subscription status',
      })
    }
  })
})

describe('createReservedCheckoutSession expiry', () => {
  const params = {
    userId: 'user-1',
    userEmail: 'user@example.com',
    tier: 'tier1',
    priceId: 'price_1',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  }

  it('returns the stored expiry when reusing a reservation', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    const rpc = vi.fn().mockResolvedValue({
      data: {
        action: 'reuse',
        reservation_id: 'reservation-1',
        session_id: 'cs_reused',
        url: 'https://checkout.test/reused',
        expires_at: '2030-01-01T00:00:00+00:00',
      },
      error: null,
    })
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toEqual({
      ok: true,
      sessionId: 'cs_reused',
      url: 'https://checkout.test/reused',
      expiresAt: '2030-01-01T00:00:00+00:00',
      reused: true,
    })
    expect(createCheckoutSession).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('reserve_stripe_checkout', {
      p_user_id: params.userId,
      p_tier: params.tier,
      p_request_fingerprint: JSON.stringify([params.priceId, params.successUrl, params.cancelUrl]),
    })
  })

  it('refuses mobile callbacks and changed price or callbacks for a live web session', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    const webFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl])
    const rpc = vi.fn((_name: string, args: { p_request_fingerprint: string }) => Promise.resolve({
      data: args.p_request_fingerprint === webFingerprint
        ? {
            action: 'reuse', reservation_id: 'reservation-1', session_id: 'cs_web',
            url: 'https://checkout.test/web', expires_at: '2030-01-01T00:00:00+00:00',
          }
        : { error: 'checkout_in_progress' },
      error: null,
    }))
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({
      ok: true, sessionId: 'cs_web', reused: true,
    })

    const changedRequests = [
      { ...params, successUrl: 'evolutioncombatives://subscription/success', cancelUrl: 'evolutioncombatives://subscription/cancel' },
      { ...params, priceId: 'price_2' },
      { ...params, successUrl: 'https://example.com/other-success' },
      { ...params, cancelUrl: 'https://example.com/other-cancel' },
    ]
    for (const request of changedRequests) {
      expect(await createReservedCheckoutSession({ admin, ...request })).toEqual({
        ok: false, status: 500, error: 'Unable to start checkout',
      })
      expect(rpc).toHaveBeenLastCalledWith('reserve_stripe_checkout', {
        p_user_id: params.userId,
        p_tier: params.tier,
        p_request_fingerprint: JSON.stringify([request.priceId, request.successUrl, request.cancelUrl]),
      })
    }
    expect(createCheckoutSession).not.toHaveBeenCalled()

    const mobile = {
      ...params,
      successUrl: 'evolutioncombatives://subscription/success',
      cancelUrl: 'evolutioncombatives://subscription/cancel',
    }
    const mobileFingerprint = JSON.stringify([mobile.priceId, mobile.successUrl, mobile.cancelUrl])
    const mobileRpc = vi.fn((_name: string, args: { p_request_fingerprint: string }) => Promise.resolve({
      data: args.p_request_fingerprint === mobileFingerprint
        ? {
            action: 'reuse', reservation_id: 'reservation-2', session_id: 'cs_mobile',
            url: 'https://checkout.test/mobile', expires_at: '2030-01-01T00:00:00+00:00',
          }
        : { error: 'checkout_in_progress' },
      error: null,
    }))
    const mobileAdmin = { rpc: mobileRpc } as never
    expect(await createReservedCheckoutSession({ admin: mobileAdmin, ...mobile })).toMatchObject({
      ok: true, sessionId: 'cs_mobile', reused: true,
    })
    expect(await createReservedCheckoutSession({ admin: mobileAdmin, ...params })).toEqual({
      ok: false, status: 500, error: 'Unable to start checkout',
    })
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns the Stripe expiry used to finalize a new reservation', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_new', url: 'https://checkout.test/new', expires_at: 1893456000,
    } as never)
    const rpc = vi.fn((name: string) => Promise.resolve(name === 'reserve_stripe_checkout'
      ? { data: { action: 'create', reservation_id: 'reservation-2', idempotency_key: 'checkout:reservation-2' }, error: null }
      : { data: true, error: null }))
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toEqual({
      ok: true,
      sessionId: 'cs_new',
      url: 'https://checkout.test/new',
      expiresAt: '2030-01-01T00:00:00.000Z',
      reused: false,
    })
    expect(rpc).toHaveBeenCalledWith('reserve_stripe_checkout', {
      p_user_id: params.userId,
      p_tier: params.tier,
      p_request_fingerprint: JSON.stringify([params.priceId, params.successUrl, params.cancelUrl]),
    })
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout_reservation', expect.objectContaining({
      p_expires_at: '2030-01-01T00:00:00.000Z',
    }))
  })

  it('retries a remotely created session with the same attempt after a timeout', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(new Error('response timed out after remote creation'))
      .mockResolvedValueOnce({ id: 'cs_remote', url: 'https://checkout.test/remote', expires_at: 1893456000 } as never)
    const rpc = vi.fn((name: string) => Promise.resolve({
      data: name === 'reserve_stripe_checkout'
        ? { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' }
        : true,
      error: null,
    }))
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toEqual({
      ok: false, status: 500, error: 'Payment processing error',
    })
    expect(rpc).toHaveBeenCalledWith('mark_stripe_checkout_retryable', {
      p_user_id: params.userId, p_reservation_id: 'reservation-1',
    })
    expect(rpc).not.toHaveBeenCalledWith('release_stripe_checkout_reservation', expect.anything())

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({
      ok: true, sessionId: 'cs_remote', reused: false,
    })
    expect(vi.mocked(createCheckoutSession).mock.calls).toHaveLength(2)
    for (const [call] of vi.mocked(createCheckoutSession).mock.calls) {
      expect(call.idempotencyKey).toBe('checkout:reservation-1')
    }
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout_reservation', expect.objectContaining({
      p_reservation_id: 'reservation-1', p_checkout_session_id: 'cs_remote',
    }))
  })

  it('consumes a completed session and refuses another payable checkout', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
      id: 'cs_old', status: 'complete', subscription: 'sub_paid',
    } as never)
    const rpc = vi.fn((name: string) => Promise.resolve({
      data: name === 'reserve_stripe_checkout'
        ? { action: 'inspect', reservation_id: 'reservation-1', session_id: 'cs_old' }
        : true,
      error: null,
    }))
    expect(await createReservedCheckoutSession({ admin: { rpc } as never, ...params })).toEqual({
      ok: false, status: 500, error: 'Unable to start checkout',
    })
    expect(rpc).toHaveBeenCalledWith('consume_stripe_checkout', {
      p_user_id: params.userId, p_checkout_session_id: 'cs_old', p_stripe_subscription_id: 'sub_paid',
    })
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled()
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it.each(['open', 'expired'] as const)('retires a Stripe %s session before creating another', async (status) => {
    vi.mocked(stripe.checkout.sessions.expire).mockClear()
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({ id: 'cs_old', status } as never)
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_new', url: 'https://checkout.test/new', expires_at: 1893456000,
    } as never)
    let reserves = 0
    const rpc = vi.fn((name: string) => Promise.resolve({
      data: name === 'reserve_stripe_checkout'
        ? ++reserves === 1
          ? { action: 'inspect', reservation_id: 'reservation-1', session_id: 'cs_old' }
          : { action: 'create', reservation_id: 'reservation-2', idempotency_key: 'checkout:reservation-2' }
        : true,
      error: null,
    }))
    expect(await createReservedCheckoutSession({ admin: { rpc } as never, ...params })).toMatchObject({
      ok: true, sessionId: 'cs_new', reused: false,
    })
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(status === 'open' ? 1 : 0)
    expect(rpc).toHaveBeenCalledWith('retire_stripe_checkout_session', {
      p_user_id: params.userId, p_reservation_id: 'reservation-1', p_checkout_session_id: 'cs_old',
    })
    expect(reserves).toBe(2)
  })

  it('keeps the reservation when Stripe cannot expire an open session', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({ id: 'cs_old', status: 'open' } as never)
    vi.mocked(stripe.checkout.sessions.expire).mockRejectedValueOnce(new Error('already complete'))
    const rpc = vi.fn().mockResolvedValue({
      data: { action: 'inspect', reservation_id: 'reservation-1', session_id: 'cs_old' }, error: null,
    })
    expect(await createReservedCheckoutSession({ admin: { rpc } as never, ...params })).toEqual({
      ok: false, status: 500, error: 'Unable to start checkout',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })
})
