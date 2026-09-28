import { describe, it, expect, vi } from 'vitest'
import { assertSingleNonTerminalSubscription } from './checkout-flow'
import { createAdminClient } from '@/src/lib/supabase'

vi.mock('@/src/lib/supabase', () => ({ createAdminClient: vi.fn() }))

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
