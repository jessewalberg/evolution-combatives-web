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

/**
 * Fake Supabase admin client with per-table insert/update/select mocks so
 * tests can assert on the exact payload written to each table, not just the
 * HTTP response status.
 */
function buildSupabase() {
  const subscriptionsInsert = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdate = vi.fn().mockReturnValue({ eq: subscriptionsUpdateEq })
  const subscriptionsSelectSingle = vi.fn().mockResolvedValue({
    data: { user_id: 'user-1' },
    error: null,
  })
  const profilesUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const profilesUpdate = vi.fn().mockReturnValue({ eq: profilesUpdateEq })

  const from = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return {
        insert: subscriptionsInsert,
        update: subscriptionsUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: subscriptionsSelectSingle }),
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
    subscriptionsInsert,
    subscriptionsUpdate,
    subscriptionsUpdateEq,
    subscriptionsSelectSingle,
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
    expect(supabase.subscriptionsInsert).not.toHaveBeenCalled()
  })

  it('handles customer.subscription.created by writing the subscription row and profile tier', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      tier: 'tier1',
      status: 'active',
      stripe_subscription_id: 'sub_1',
      stripe_customer_id: 'cus_1',
      current_period_start: new Date(1700000000 * 1000).toISOString(),
      current_period_end: new Date(1702592000 * 1000).toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
    })
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: 'tier1' })
    expect(supabase.profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('handles customer.subscription.updated by updating status and period fields', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'past_due',
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: true,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({
      status: 'past_due',
      current_period_start: new Date(1700000000 * 1000).toISOString(),
      current_period_end: new Date(1702592000 * 1000).toISOString(),
      cancel_at_period_end: true,
      canceled_at: null,
    })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('handles customer.subscription.updated canceled path by clearing the profile tier', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'canceled',
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: true,
        canceled_at: 1701000000,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        canceled_at: new Date(1701000000 * 1000).toISOString(),
      })
    )
    expect(supabase.subscriptionsSelectSingle).toHaveBeenCalled()
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: null })
    expect(supabase.profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('handles customer.subscription.deleted by canceling the subscription and clearing profile tier', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.deleted', { id: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' })
    )
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
    expect(supabase.profilesUpdate).toHaveBeenCalledWith({ subscription_tier: null })
    expect(supabase.profilesUpdateEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('handles invoice.payment_succeeded by reactivating the subscription', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({ status: 'active' })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
  })

  it('handles invoice.payment_failed by marking the subscription past_due', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({ status: 'past_due' })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
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
      makeEvent('customer.subscription.created', {
        id: 'sub_2',
        status: 'active',
        customer: 'cus_1',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.subscriptionsInsert).not.toHaveBeenCalled()
  })

  it('returns 400 when subscription insert fails', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_fail',
        status: 'active',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )
    supabase.subscriptionsInsert.mockResolvedValue({ error: { message: 'dup' } })

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Webhook handler failed')
    expect(supabase.profilesUpdate).not.toHaveBeenCalled()
  })

  it('handles invoice events without subscription by skipping the DB update', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { subscription: null })
    )
    const res1 = await POST(webhookRequest('{}', 'sig'))
    expect(res1.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()

    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', { subscription: null })
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
