import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'
import type Stripe from 'stripe'

vi.mock('@/src/lib/stripe', () => ({
  validateWebhookSignature: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { validateWebhookSignature } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'

const mockValidateWebhookSignature = vi.mocked(validateWebhookSignature)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function makeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: 'evt_1',
    type,
    data: { object },
  } as unknown as Stripe.Event
}

function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user-1', tier: 'tier1' },
    items: {
      data: [
        {
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      ],
    },
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    ...overrides,
  }
}

function invoiceForSubscription(
  subscription: string | Record<string, unknown> | null
) {
  return subscription
    ? {
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription },
        },
      }
    : { parent: null }
}

/**
 * Fake Supabase admin client with per-table upsert/update/select mocks so
 * tests can assert on the exact payload written to each table, not just the
 * HTTP response status.
 */
function buildSupabase() {
  const subscriptionsUpsert = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdate = vi.fn().mockReturnValue({ eq: subscriptionsUpdateEq })
  const subscriptionsSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: { user_id: 'user-1', tier: 'tier1', status: 'active' },
    error: null,
  })
  const profilesUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const profilesUpdate = vi.fn().mockReturnValue({ eq: profilesUpdateEq })

  const from = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return {
        upsert: subscriptionsUpsert,
        update: subscriptionsUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: subscriptionsSelectMaybeSingle,
          }),
        }),
      }
    }
    if (table === 'profiles') {
      return { update: profilesUpdate }
    }
    return {}
  })

  return {
    from,
    subscriptionsUpsert,
    subscriptionsUpdate,
    subscriptionsUpdateEq,
    subscriptionsSelectMaybeSingle,
    profilesUpdate,
    profilesUpdateEq,
  }
}

function webhookRequest(body: string, signature?: string) {
  return createNextRequest('/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  })
}

describe('POST /api/webhooks/stripe', () => {
  let supabase: ReturnType<typeof buildSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase as never)
  })

  it('returns 400 when signature header is missing', async () => {
    const res = await POST(webhookRequest('{}'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Missing signature')
    expect(mockValidateWebhookSignature).not.toHaveBeenCalled()
  })

  it('returns 400 when signature validation fails', async () => {
    mockValidateWebhookSignature.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(webhookRequest('{}', 'bad-sig'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Webhook handler failed')
  })

  it('handles checkout.session.completed without writing to the database', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('checkout.session.completed', {
        id: 'cs_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(supabase.subscriptionsUpsert).not.toHaveBeenCalled()
  })

  it('derives Basil billing periods from items and idempotently upserts a created subscription', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', subscriptionObject())
    )

    const first = await POST(webhookRequest('{}', 'sig'))
    const duplicate = await POST(webhookRequest('{}', 'sig'))
    expect(first.status).toBe(200)
    expect(duplicate.status).toBe(200)

    expect(supabase.subscriptionsUpsert).toHaveBeenCalledTimes(2)
    expect(supabase.subscriptionsUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        platform: 'stripe',
        external_subscription_id: 'sub_1',
        tier: 'tier1',
        status: 'active',
        stripe_subscription_id: 'sub_1',
        stripe_customer_id: 'cus_1',
        current_period_start: new Date(1700000000 * 1000).toISOString(),
        current_period_end: new Date(1702592000 * 1000).toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id,platform' }
    )
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: 'tier1' })
    expect(supabase.profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('upserts an update that arrives before creation and keeps access during dunning', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', subscriptionObject({
        status: 'past_due',
        cancel_at_period_end: true,
      }))
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'past_due',
        current_period_start: new Date(1700000000 * 1000).toISOString(),
        current_period_end: new Date(1702592000 * 1000).toISOString(),
        cancel_at_period_end: true,
      }),
      { onConflict: 'user_id,platform' }
    )
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('applies a resumed tier change to the subscription and profile', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.resumed',
        subscriptionObject({
          status: 'active',
          metadata: { userId: 'user-1', tier: 'tier2' },
        })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'tier2', status: 'active' }),
      { onConflict: 'user_id,platform' }
    )
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({
      subscription_tier: 'tier2',
    })
  })

  it('updates an existing subscription when legacy metadata is missing', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.updated',
        subscriptionObject({ metadata: {}, status: 'past_due' })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'past_due',
        current_period_end: new Date(1702592000 * 1000).toISOString(),
      })
    )
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith(
      'stripe_subscription_id',
      'sub_1'
    )
  })

  it('clears profile access for canceled and paused subscription updates', async () => {
    for (const [eventType, status] of [
      ['customer.subscription.updated', 'canceled'],
      ['customer.subscription.paused', 'paused'],
    ] as const) {
      vi.clearAllMocks()
      mockCreateAdminClient.mockReturnValue(supabase as never)
      mockValidateWebhookSignature.mockReturnValue(
        makeEvent(
          eventType,
          subscriptionObject({ status, canceled_at: 1701000000 })
        )
      )

      const res = await POST(webhookRequest('{}', 'sig'))
      expect(res.status).toBe(200)
      expect(supabase.subscriptionsUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
        { onConflict: 'user_id,platform' }
      )
      expect(supabase.profilesUpdate).toHaveBeenCalledWith({
        subscription_tier: null,
      })
    }

    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: null })
    expect(supabase.profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('uses Stripe ended_at when a subscription is deleted', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.deleted',
        subscriptionObject({
          status: 'canceled',
          canceled_at: 1701000000,
          ended_at: 1702000000,
        })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        canceled_at: new Date(1702000000 * 1000).toISOString(),
      }),
      { onConflict: 'user_id,platform' }
    )
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: null })
  })

  it('does not resurrect a terminal subscription from a stale event', async () => {
    supabase.subscriptionsSelectMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', tier: 'tier1', status: 'canceled' },
      error: null,
    })
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', subscriptionObject())
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsUpsert).not.toHaveBeenCalled()
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('reads the Basil invoice parent and reactivates subscription access', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'invoice.payment_succeeded',
        invoiceForSubscription('sub_1')
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({
      status: 'active',
      updated_at: expect.any(String),
    })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: 'tier1' })
  })

  it('handles invoice.paid with an expanded parent subscription', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'invoice.paid',
        invoiceForSubscription({ id: 'sub_expanded', status: 'active' })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith(
      'stripe_subscription_id',
      'sub_expanded'
    )
  })

  it('marks a non-terminal subscription past_due after a failed payment', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', invoiceForSubscription('sub_1'))
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({
      status: 'past_due',
      updated_at: expect.any(String),
    })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
  })

  it('does not let a delayed invoice event overwrite a terminal subscription', async () => {
    supabase.subscriptionsSelectMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', tier: 'tier1', status: 'canceled' },
      error: null,
    })
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', invoiceForSubscription('sub_1'))
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 for unhandled event types', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.created', { id: 'cus_new' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('skips checkout.session.completed when metadata missing', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('checkout.session.completed', { id: 'cs_2', metadata: {} })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('skips subscription.created when metadata missing', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.created',
        subscriptionObject({ id: 'sub_2', metadata: {} })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 so Stripe retries when an idempotent upsert fails', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.created',
        subscriptionObject({ id: 'sub_fail' })
      )
    )
    supabase.subscriptionsUpsert.mockResolvedValue({
      error: { message: 'database unavailable' },
    })

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Webhook handler failed')
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for a Basil subscription without an item billing period', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent(
        'customer.subscription.created',
        subscriptionObject({ items: { data: [] } })
      )
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Webhook handler failed')
    expect(supabase.subscriptionsUpsert).not.toHaveBeenCalled()
  })

  it('returns 400 so Stripe retries when profile synchronization fails', async () => {
    supabase.profilesUpdateEq.mockResolvedValue({
      error: { message: 'profile unavailable' },
    })
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', subscriptionObject())
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect(supabase.subscriptionsUpsert).toHaveBeenCalled()
  })

  it('returns 400 so Stripe retries when an invoice status write fails', async () => {
    supabase.subscriptionsUpdateEq.mockResolvedValue({
      error: { message: 'status unavailable' },
    })
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', invoiceForSubscription('sub_1'))
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Webhook handler failed')
  })

  it('handles invoice events without subscription by skipping the DB update', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', invoiceForSubscription(null))
    )
    const res1 = await POST(webhookRequest('{}', 'sig'))
    expect(res1.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()

    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', {
        parent: { type: 'quote_details', subscription_details: null },
      })
    )
    const res2 = await POST(webhookRequest('{}', 'sig'))
    expect(res2.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()
  })
})

describe('GET /api/webhooks/stripe', () => {
  it('returns health check', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.service).toBe('stripe-webhooks')
  })
})
