import { describe, it, expect, vi } from 'vitest'
import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from './checkout-flow'
import { createAdminClient } from '@/src/lib/supabase'
import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'

vi.mock('@/src/lib/supabase', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/src/lib/stripe', () => ({ createCheckoutSession: vi.fn(), getOrCreateCustomer: vi.fn() }))

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
    const admin = { rpc: vi.fn().mockResolvedValue({
      data: {
        action: 'reuse',
        reservation_id: 'reservation-1',
        session_id: 'cs_reused',
        url: 'https://checkout.test/reused',
        expires_at: '2030-01-01T00:00:00+00:00',
      },
      error: null,
    }) } as never

    expect(await createReservedCheckoutSession({ admin, ...params })).toEqual({
      ok: true,
      sessionId: 'cs_reused',
      url: 'https://checkout.test/reused',
      expiresAt: '2030-01-01T00:00:00+00:00',
      reused: true,
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
    expect(rpc).toHaveBeenCalledWith('finalize_stripe_checkout_reservation', expect.objectContaining({
      p_expires_at: '2030-01-01T00:00:00.000Z',
    }))
  })
})
