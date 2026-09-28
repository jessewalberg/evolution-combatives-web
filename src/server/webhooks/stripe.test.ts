import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './stripe'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)
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

type StoredSub = Record<string, unknown>

function buildSupabase() {
  const subscriptions: StoredSub[] = []
  const profiles = new Map<string, { subscription_tier: string | null }>([
    ['user-1', { subscription_tier: null }],
  ])

  const recordCreated = vi.fn(async ({ p_subscription: p }: { p_subscription: Record<string, unknown> }) => {
    const stripeId = p.stripe_subscription_id as string
    if (subscriptions.some((row) => row.stripe_subscription_id === stripeId)) {
      return { data: false, error: null }
    }
    subscriptions.push({ ...p })
    const userId = p.user_id as string
    const profile = profiles.get(userId)
    if (!profile) {
      subscriptions.pop()
      return { error: { message: 'Profile missing for Stripe subscription' } }
    }
    profile.subscription_tier = p.tier as string
    return { data: true, error: null }
  })

  const applyState = vi.fn(async ({ p_subscription: p }: { p_subscription: Record<string, unknown> }) => {
    const stripeId = p.stripe_subscription_id as string
    const existing = subscriptions.find((row) => row.stripe_subscription_id === stripeId)
    if (existing) {
      Object.assign(existing, p)
    } else if (p.user_id) {
      subscriptions.push({ ...p })
    }
    if (['canceled', 'incomplete_expired', 'unpaid'].includes(String(p.status))) {
      const userId = (existing?.user_id ?? p.user_id) as string | undefined
      if (userId && profiles.has(userId)) {
        profiles.get(userId)!.subscription_tier = null
      }
    }
    return { error: null }
  })

  const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdate = vi.fn().mockReturnValue({ eq: subscriptionsUpdateEq })

  const from = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return { update: subscriptionsUpdate }
    }
    return {}
  })

  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === 'record_stripe_subscription_created') {
      return recordCreated(args)
    }
    if (name === 'apply_stripe_subscription_state') {
      return applyState(args)
    }
    return Promise.resolve({ error: new Error('Unknown RPC') })
  })

  return {
    from,
    rpc,
    recordCreated,
    applyState,
    subscriptionsUpdate,
    subscriptionsUpdateEq,
    get subscriptions() {
      return subscriptions
    },
    getProfileTier(userId: string) {
      return profiles.get(userId)?.subscription_tier ?? null
    },
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
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('checkout.session.completed', {
        id: 'cs_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(supabase.recordCreated).not.toHaveBeenCalled()
  })

  it('handles customer.subscription.created by atomically recording the subscription and profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
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

    expect(supabase.rpc).toHaveBeenCalledWith('record_stripe_subscription_created', {
      p_subscription: expect.objectContaining({
        user_id: 'user-1',
        stripe_subscription_id: 'sub_1',
        tier: 'tier1',
      }),
    })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
    expect(supabase.subscriptions).toHaveLength(1)
  })

  it('returns 200 when customer.subscription.created is replayed (idempotent)', async () => {
    const created = makeEvent('customer.subscription.created', {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      metadata: { userId: 'user-1', tier: 'tier1' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      canceled_at: null,
    })
    mockValidateWebhookSignature.mockResolvedValue(created)

    const first = await POST(webhookRequest('{}', 'sig'))
    const second = await POST(webhookRequest('{}', 'sig'))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(supabase.recordCreated).toHaveBeenCalledTimes(2)
    expect(supabase.subscriptions).toHaveLength(1)
  })

  it('keeps a canceled subscription and profile canceled when created is replayed', async () => {
    const created = makeEvent('customer.subscription.created', {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      metadata: { userId: 'user-1', tier: 'tier1' },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
      canceled_at: null,
    })
    mockValidateWebhookSignature.mockResolvedValue(created)

    const first = await POST(webhookRequest('{}', 'sig'))
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', {
        id: 'sub_1',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )
    const deleted = await POST(webhookRequest('{}', 'sig'))
    mockValidateWebhookSignature.mockResolvedValue(created)
    const replay = await POST(webhookRequest('{}', 'sig'))

    expect(first.status).toBe(200)
    expect(deleted.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(supabase.subscriptions[0]?.status).toBe('canceled')
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('returns 500 when profile tier update fails and leaves no subscription row persisted', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_missing_profile',
        status: 'active',
        customer: 'cus_1',
        metadata: { userId: 'user-without-profile', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(500)
    expect(supabase.subscriptions).toHaveLength(0)
  })

  it('handles customer.subscription.updated through apply_stripe_subscription_state', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'past_due',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: true,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.applyState).toHaveBeenCalledWith({
      p_subscription: expect.objectContaining({
        stripe_subscription_id: 'sub_1',
        status: 'past_due',
      }),
    })
  })

  it('handles customer.subscription.updated canceled path by clearing the profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'canceled',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: true,
        canceled_at: 1701000000,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('handles customer.subscription.deleted by canceling the subscription and clearing profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', {
        id: 'sub_1',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.applyState).toHaveBeenCalledWith({
      p_subscription: expect.objectContaining({
        stripe_subscription_id: 'sub_1',
        status: 'canceled',
      }),
    })
  })

  it('handles invoice.payment_succeeded by reactivating the subscription', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({
      status: 'active',
      updated_at: expect.any(String),
    })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
  })

  it('handles invoice.payment_failed by marking the subscription past_due', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_failed', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.subscriptionsUpdate).toHaveBeenCalledWith({
      status: 'past_due',
      updated_at: expect.any(String),
    })
    expect(supabase.subscriptionsUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_1')
  })

  it('returns 200 for unhandled event types', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.created', { id: 'cus_new' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('skips checkout.session.completed when metadata missing', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('checkout.session.completed', { id: 'cs_2', metadata: {} })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('skips subscription.created when metadata missing', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
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
    expect(supabase.recordCreated).not.toHaveBeenCalled()
  })

  it('returns 500 when subscription upsert fails', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
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
    supabase.recordCreated.mockResolvedValueOnce({ error: { message: 'db failure' } })

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Webhook handler failed')
  })

  it('handles invoice events without subscription by skipping the DB update', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { subscription: null })
    )
    const res1 = await POST(webhookRequest('{}', 'sig'))
    expect(res1.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_failed', { subscription: null })
    )
    const res2 = await POST(webhookRequest('{}', 'sig'))
    expect(res2.status).toBe(200)
    expect(supabase.subscriptionsUpdate).not.toHaveBeenCalled()
  })
})

describe('GET /api/webhooks/stripe', () => {
  it('returns health check', async () => {
    const { GET } = await import('./stripe')
    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.service).toBe('stripe-webhooks')
  })
})
