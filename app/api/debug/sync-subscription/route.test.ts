import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'

vi.mock('../../../../src/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn(),
    },
    customers: {
      list: vi.fn(),
      retrieve: vi.fn(),
    },
  },
}))

vi.mock('../../../../src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { stripe } from '../../../../src/lib/stripe'
import { createAdminClient } from '../../../../src/lib/supabase'

const mockStripe = vi.mocked(stripe)
const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockSubscriptionsRetrieve = mockStripe.subscriptions.retrieve as unknown as Mock
const mockSubscriptionsList = mockStripe.subscriptions.list as unknown as Mock
const mockCustomersList = mockStripe.customers.list as unknown as Mock
const mockCustomersRetrieve = mockStripe.customers.retrieve as unknown as Mock

/**
 * Current behavior: this debug endpoint has NO auth check in the handler.
 * It proceeds directly to business logic when given valid input.
 */
describe('POST /api/debug/sync-subscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not enforce auth middleware — proceeds to Stripe lookup', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      metadata: { tier: 'tier1' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_test_tier1' } }] },
    } as never)

    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_123',
      email: 'user@example.com',
    } as never)

    const profilesSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-1' },
      error: null,
    })
    const existingSubSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: profilesSingle }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ single: existingSubSingle }),
              }),
            }),
            insert,
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_123' }),
      })
    )
    const body = await res.json()

    // Not 401 — handler has no auth gate
    expect(res.status).not.toBe(401)
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Subscription synced successfully')
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123')
  })

  it('returns 400 when neither email nor subscription id provided', async () => {
    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Email or Stripe subscription ID required')
  })

  it('returns 404 when email has no stripe customer', async () => {
    mockCustomersList.mockResolvedValue({ data: [] } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ email: 'missing@example.com' }),
      })
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('No customer found with that email')
  })

  it('returns 404 when customer has no active subscription', async () => {
    mockCustomersList.mockResolvedValue({
      data: [{ id: 'cus_1', email: 'user@example.com' }],
    } as never)
    mockSubscriptionsList.mockResolvedValue({ data: [] } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      })
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('No active subscription found for customer')
  })

  it('syncs by email and updates existing subscription', async () => {
    mockCustomersList.mockResolvedValue({
      data: [{ id: 'cus_1', email: 'user@example.com' }],
    } as never)
    mockSubscriptionsList.mockResolvedValue({
      data: [
        {
          id: 'sub_existing',
          status: 'active',
          customer: 'cus_1',
          metadata: {},
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: 'price_intermediate_tier2' } }] },
        },
      ],
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'sub-row-1' }, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.tier).toBe('tier2')
  })

  it('returns 404 when user not in database', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      metadata: { tier: 'tier3' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_x' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_123',
      email: 'ghost@example.com',
    } as never)
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
          }),
        }),
      })),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_123' }),
      })
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('User not found in database')
  })

  it('returns 500 when stripe retrieve throws', async () => {
    mockSubscriptionsRetrieve.mockRejectedValue(new Error('stripe down'))

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_bad' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to sync subscription')
    expect(body.details).toBe('stripe down')
  })

  it('infers tier3 from advanced price id when metadata missing', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_adv',
      status: 'active',
      customer: 'cus_1',
      metadata: {},
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_advanced_tier3' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    const insert = vi.fn().mockResolvedValue({ error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert,
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_adv' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.tier).toBe('tier3')
    expect(insert).toHaveBeenCalled()
  })

  it('defaults to tier1 when price id has no tier hint', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_default',
      status: 'active',
      customer: 'cus_1',
      metadata: {},
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_unknown_xyz' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    const insert = vi.fn().mockResolvedValue({ error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert,
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_default' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.tier).toBe('tier1')
  })

  it('infers tier1 from beginner price id', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_beg',
      status: 'active',
      customer: 'cus_1',
      metadata: {},
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_beginner_monthly' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    const insert = vi.fn().mockResolvedValue({ error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert,
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_beg' }),
      })
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.tier).toBe('tier1')
  })

  it('returns 500 when existing subscription update fails', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_1',
      metadata: { tier: 'tier2' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_x' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'sub-row-1' }, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }),
            }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_123' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to sync subscription')
  })

  it('returns 500 when subscription insert fails', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_new',
      status: 'active',
      customer: 'cus_1',
      metadata: { tier: 'tier1' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_x' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_new' }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to sync subscription')
  })

  it('returns 500 when profile tier update fails', async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_1',
      metadata: { tier: 'tier2' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      items: { data: [{ price: { id: 'price_x' } }] },
    } as never)
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_1',
      email: 'user@example.com',
    } as never)

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'profile fail' } }),
            }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    } as never)

    const res = await POST(
      createNextRequest('/api/debug/sync-subscription', {
        method: 'POST',
        body: JSON.stringify({ stripeSubscriptionId: 'sub_123' }),
      })
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to sync subscription')
  })
})
