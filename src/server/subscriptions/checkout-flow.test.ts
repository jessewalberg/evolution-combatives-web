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
      p_request_fingerprint: JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail]),
    })
  })

  it('refuses mobile callbacks and changed price or callbacks for a live web session', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    const webFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail])
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
        p_request_fingerprint: JSON.stringify([request.priceId, request.successUrl, request.cancelUrl, request.userEmail]),
      })
    }
    expect(createCheckoutSession).not.toHaveBeenCalled()

    const mobile = {
      ...params,
      successUrl: 'evolutioncombatives://subscription/success',
      cancelUrl: 'evolutioncombatives://subscription/cancel',
    }
    const mobileFingerprint = JSON.stringify([mobile.priceId, mobile.successUrl, mobile.cancelUrl, mobile.userEmail])
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
      p_request_fingerprint: JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail]),
    })
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout_reservation', expect.objectContaining({
      p_expires_at: '2030-01-01T00:00:00.000Z',
    }))
  })

  it.each([
    ['connection timeout', Object.assign(new Error('connection timed out'), { type: 'StripeConnectionError' })],
    ['Stripe API failure', Object.assign(new Error('server failed'), { type: 'StripeAPIError' })],
    ['unknown failure', new Error('unknown failure')],
  ] as const)('retries a remotely created session after %s', async (_case, createError) => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(createError)
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

  it.each([
    'StripeInvalidRequestError',
    'StripeAuthenticationError',
    'StripePermissionError',
  ])('releases a definite %s rejection so corrected input can checkout', async (type) => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(Object.assign(new Error('rejected before creation'), { type }))
      .mockResolvedValueOnce({ id: 'cs_corrected', url: 'https://checkout.test/corrected', expires_at: 1893456000 } as never)
    let released = false
    const rpc = vi.fn((name: string, args: Record<string, string>) => {
      if (name === 'release_stripe_checkout_reservation') released = true
      if (name === 'reserve_stripe_checkout') {
        return Promise.resolve({
          data: args.p_request_fingerprint.includes('price_corrected')
            ? released
              ? { action: 'create', reservation_id: 'reservation-2', idempotency_key: 'checkout:reservation-2' }
              : { error: 'checkout_in_progress' }
            : { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' },
          error: null,
        })
      }
      return Promise.resolve({ data: true, error: null })
    })
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toEqual({
      ok: false, status: 500, error: 'Payment processing error',
    })
    expect(rpc).toHaveBeenCalledWith('release_stripe_checkout_reservation', {
      p_user_id: params.userId, p_reservation_id: 'reservation-1',
    })
    expect(rpc).not.toHaveBeenCalledWith('mark_stripe_checkout_retryable', expect.anything())
    expect(await createReservedCheckoutSession({ admin, ...params, priceId: 'price_corrected' })).toMatchObject({
      ok: true, sessionId: 'cs_corrected', reused: false,
    })
    expect(vi.mocked(createCheckoutSession).mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      'checkout:reservation-1', 'checkout:reservation-2',
    ])
  })

  it('resolves a rejected old attempt after its first release fails', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    const rejection = Object.assign(new Error('invalid price'), { type: 'StripeInvalidRequestError' })
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(rejection)
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce({ id: 'cs_corrected', url: 'https://checkout.test/corrected', expires_at: 1893456000 } as never)
    const oldFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail])
    let reservedOld = false
    let releaseCalls = 0
    let oldReleased = false
    const rpc = vi.fn((name: string) => {
      if (name === 'reserve_stripe_checkout') {
        if (!reservedOld) {
          reservedOld = true
          return Promise.resolve({ data: { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' }, error: null })
        }
        if (!oldReleased) {
          return Promise.resolve({ data: {
            action: 'inspect_pending', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1',
            tier: params.tier, request_fingerprint: oldFingerprint,
          }, error: null })
        }
        return Promise.resolve({ data: { action: 'create', reservation_id: 'reservation-2', idempotency_key: 'checkout:reservation-2' }, error: null })
      }
      if (name === 'release_stripe_checkout_reservation') {
        releaseCalls += 1
        if (releaseCalls === 1) return Promise.resolve({ data: null, error: { message: 'database unavailable' } })
        oldReleased = true
      }
      return Promise.resolve({ data: true, error: null })
    })
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({ ok: false, status: 500 })
    expect(await createReservedCheckoutSession({ admin, ...params, priceId: 'price_corrected' })).toMatchObject({
      ok: true, sessionId: 'cs_corrected',
    })
    expect(releaseCalls).toBe(2)
    expect(vi.mocked(createCheckoutSession).mock.calls.map(([call]) => [call.priceId, call.idempotencyKey])).toEqual([
      ['price_1', 'checkout:reservation-1'],
      ['price_1', 'checkout:reservation-1'],
      ['price_corrected', 'checkout:reservation-2'],
    ])
  })

  it('finalizes an old remotely created session before considering changed input', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(Object.assign(new Error('timed out'), { type: 'StripeConnectionError' }))
      .mockResolvedValueOnce({ id: 'cs_remote', url: 'https://checkout.test/remote', expires_at: 1893456000 } as never)
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
      id: 'cs_remote', status: 'open', url: 'https://checkout.test/remote', expires_at: 1893456000,
    } as never)
    const oldFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail])
    let reserves = 0
    const rpc = vi.fn((name: string) => Promise.resolve({
      data: name === 'reserve_stripe_checkout'
        ? ++reserves === 1
          ? { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' }
          : { action: 'inspect_pending', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1', tier: params.tier, request_fingerprint: oldFingerprint }
        : true,
      error: null,
    }))
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({ ok: false, status: 500 })
    expect(await createReservedCheckoutSession({ admin, ...params, successUrl: 'https://example.com/new-success' })).toEqual({
      ok: false, status: 500, error: 'Unable to start checkout',
    })
    expect(reserves).toBe(2)
    expect(vi.mocked(createCheckoutSession).mock.calls.map(([call]) => [call.priceId, call.successUrl, call.idempotencyKey])).toEqual([
      ['price_1', params.successUrl, 'checkout:reservation-1'],
      ['price_1', params.successUrl, 'checkout:reservation-1'],
    ])
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout_reservation', expect.objectContaining({
      p_reservation_id: 'reservation-1', p_checkout_session_id: 'cs_remote',
    }))
    expect(rpc).not.toHaveBeenCalledWith('release_stripe_checkout_reservation', expect.anything())
  })

  it('recovers a missing URL after expiration and a failed release', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createCheckoutSession)
      .mockResolvedValueOnce({ id: 'cs_old', url: null, expires_at: 1893456000 } as never)
      .mockResolvedValueOnce({ id: 'cs_old', url: null, expires_at: 1893456000 } as never)
      .mockResolvedValueOnce({ id: 'cs_new', url: 'https://checkout.test/new', expires_at: 1893456000 } as never)
    vi.mocked(stripe.checkout.sessions.expire).mockReset().mockResolvedValue({ id: 'cs_old', status: 'expired' } as never)
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({ id: 'cs_old', status: 'expired' } as never)
    const oldFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail])
    let reserves = 0
    let releases = 0
    const rpc = vi.fn((name: string) => {
      if (name === 'reserve_stripe_checkout') {
        reserves += 1
        return Promise.resolve({ data: reserves === 1
          ? { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' }
          : reserves === 2
            ? { action: 'inspect_pending', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1', tier: params.tier, request_fingerprint: oldFingerprint }
            : { action: 'create', reservation_id: 'reservation-2', idempotency_key: 'checkout:reservation-2' }, error: null })
      }
      if (name === 'release_stripe_checkout_reservation' && ++releases === 1) {
        return Promise.resolve({ data: null, error: { message: 'database unavailable' } })
      }
      return Promise.resolve({ data: true, error: null })
    })
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({ ok: false, status: 500 })
    expect(await createReservedCheckoutSession({ admin, ...params, priceId: 'price_corrected' })).toMatchObject({
      ok: true, sessionId: 'cs_new',
    })
    expect(releases).toBe(2)
    expect(vi.mocked(createCheckoutSession).mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      'checkout:reservation-1', 'checkout:reservation-1', 'checkout:reservation-2',
    ])
  })

  it('keeps the old session when finalization fails and completes it on recovery', async () => {
    vi.mocked(getOrCreateCustomer).mockResolvedValue({ id: 'cus_1' } as never)
    vi.mocked(createCheckoutSession).mockReset().mockResolvedValue({
      id: 'cs_old', url: 'https://checkout.test/old', expires_at: 1893456000,
    } as never)
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
      id: 'cs_old', status: 'open', url: 'https://checkout.test/old', expires_at: 1893456000,
    } as never)
    const oldFingerprint = JSON.stringify([params.priceId, params.successUrl, params.cancelUrl, params.userEmail])
    let reserves = 0
    let finalizations = 0
    const rpc = vi.fn((name: string) => {
      if (name === 'reserve_stripe_checkout') {
        reserves += 1
        return Promise.resolve({ data: reserves === 1
          ? { action: 'create', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1' }
          : { action: 'inspect_pending', reservation_id: 'reservation-1', idempotency_key: 'checkout:reservation-1', tier: params.tier, request_fingerprint: oldFingerprint }, error: null })
      }
      if (name === 'finalize_stripe_checkout_reservation' && ++finalizations === 1) {
        return Promise.resolve({ data: null, error: { message: 'database unavailable' } })
      }
      return Promise.resolve({ data: true, error: null })
    })
    const admin = { rpc } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toMatchObject({ ok: false, status: 500 })
    expect(await createReservedCheckoutSession({ admin, ...params, priceId: 'price_corrected' })).toEqual({
      ok: false, status: 500, error: 'Unable to start checkout',
    })
    expect(finalizations).toBe(2)
    expect(reserves).toBe(2)
    expect(vi.mocked(createCheckoutSession).mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      'checkout:reservation-1', 'checkout:reservation-1',
    ])
    expect(rpc).not.toHaveBeenCalledWith('release_stripe_checkout_reservation', expect.anything())
  })

  it('consumes a completed session and refuses another payable checkout', async () => {
    vi.mocked(createCheckoutSession).mockClear()
    vi.mocked(stripe.checkout.sessions.expire).mockClear()
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
