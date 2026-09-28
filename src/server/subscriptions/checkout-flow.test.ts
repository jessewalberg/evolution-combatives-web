import { describe, it, expect, vi } from 'vitest'
import { assertSingleNonTerminalSubscription } from './checkout-flow'

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
})
