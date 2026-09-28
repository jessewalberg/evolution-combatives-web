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

type Row = Record<string, unknown>

const TERMINAL = new Set(['canceled', 'incomplete_expired', 'unpaid'])

/**
 * Faithful in-memory emulation of public.apply_stripe_subscription_event
 * (supabase/migrations/20260928000000_record_stripe_subscription_created.sql).
 *
 * This sandbox has no Postgres/pglite available to run the real SQL
 * function, so this store reproduces its exact WHERE-guard semantics
 * (single row per user keyed like the real UNIQUE (user_id, platform)
 * constraint, ordering guards, and the atomic profile requirement) so these
 * tests fail if the TypeScript call site stops matching that contract, and
 * so the rollback assertions check persisted store state, not just the
 * HTTP status code.
 */
function buildSupabase() {
  // one row per user_id, mirroring UNIQUE (user_id, platform)
  const subscriptions = new Map<string, Row>()
  const profiles = new Map<string, { subscription_tier: string | null }>([
    ['user-1', { subscription_tier: null }],
  ])

  function applyEvent(p: Row, isCreation: boolean): { error?: { message: string } } {
    const stripeId = p.stripe_subscription_id as string
    const status = p.status as string
    const tier = (p.tier as string | undefined) || undefined
    if (!stripeId) return {}

    let writtenUserId: string | undefined

    if (isCreation) {
      const userId = p.user_id as string | undefined
      if (!userId) return {}
      const existing = subscriptions.get(userId)
      const guardPasses = !existing || existing.stripe_subscription_id === stripeId || TERMINAL.has(existing.status as string)
      if (!guardPasses) {
        return {} // skip: still-active different subscription (R1)
      }
      subscriptions.set(userId, { ...p })
      writtenUserId = userId
    } else {
      // update/delete: only touch a row whose *current* stripe id still
      // matches - a stale event for a superseded id is a no-op (R3)
      for (const [userId, row] of subscriptions) {
        if (row.stripe_subscription_id === stripeId) {
          Object.assign(row, p)
          writtenUserId = userId
          break
        }
      }
      if (!writtenUserId) return {} // out-of-order or superseded: no-op
    }

    const profile = profiles.get(writtenUserId)
    if (!profile) {
      // atomic: simulate the whole RPC call rolling back (R2)
      if (isCreation) {
        subscriptions.delete(writtenUserId)
      }
      return { error: { message: `Profile missing for Stripe subscription ${stripeId}` } }
    }
    profile.subscription_tier = TERMINAL.has(status) ? null : (tier ?? profile.subscription_tier)
    return {}
  }

  const rpc = vi.fn((name: string, args: { p_subscription: Row; p_is_creation: boolean }) => {
    if (name !== 'apply_stripe_subscription_event') {
      return Promise.resolve({ error: new Error('Unknown RPC') })
    }
    return Promise.resolve(applyEvent(args.p_subscription, args.p_is_creation))
  })

  const subscriptionsUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const subscriptionsUpdate = vi.fn().mockReturnValue({ eq: subscriptionsUpdateEq })

  const from = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return { update: subscriptionsUpdate }
    }
    return {}
  })

  return {
    from,
    rpc,
    subscriptionsUpdate,
    subscriptionsUpdateEq,
    rowForUser(userId: string) {
      return subscriptions.get(userId)
    },
    hasAnyRow() {
      return subscriptions.size > 0
    },
    getProfileTier(userId: string) {
      return profiles.get(userId)?.subscription_tier ?? null
    },
    deleteProfile(userId: string) {
      profiles.delete(userId)
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

function subscriptionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user-1', tier: 'tier1' },
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    cancel_at_period_end: false,
    canceled_at: null,
    ...overrides,
  }
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
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('handles customer.subscription.created by recording the subscription and profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    expect(supabase.rpc).toHaveBeenCalledWith('apply_stripe_subscription_event', {
      p_subscription: expect.objectContaining({
        user_id: 'user-1',
        stripe_subscription_id: 'sub_1',
        tier: 'tier1',
      }),
      p_is_creation: true,
    })
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('returns 200 and is idempotent when customer.subscription.created is replayed', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )

    const first = await POST(webhookRequest('{}', 'sig'))
    const second = await POST(webhookRequest('{}', 'sig'))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('resubscribe: a new created event replaces a canceled subscription for the same user', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')
    expect(supabase.getProfileTier('user-1')).toBeNull()

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_new', status: 'active' }))
    )
    const resubscribe = await POST(webhookRequest('{}', 'sig'))

    expect(resubscribe.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('skips a created event for a different id while an active subscription still exists (no overwrite, no error)', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_active' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_other' }))
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_active' })
  })

  it('out-of-order: an updated event that arrives before its created event is a no-op, not an error', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ status: 'past_due' }))
    )

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.hasAnyRow()).toBe(false)
  })

  it('out-of-order: a stale updated event for a superseded subscription id cannot revive canceled state', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_new' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    // A delayed "updated" for the superseded sub_old must not touch sub_new's row
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ id: 'sub_old', status: 'active' }))
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('returns 500 and persists no subscription row when the profile is missing (atomic rollback)', async () => {
    supabase.deleteProfile('user-1')
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Webhook handler failed')
    expect(supabase.hasAnyRow()).toBe(false)
  })

  it('handles customer.subscription.updated by updating status and period fields', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ status: 'past_due', cancel_at_period_end: true }))
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'past_due', cancel_at_period_end: true })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('handles customer.subscription.updated canceled path by clearing the profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ status: 'canceled', canceled_at: 1701000000 }))
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'canceled' })
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('handles customer.subscription.deleted by canceling the subscription and clearing profile tier', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent())
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'canceled' })
    expect(supabase.getProfileTier('user-1')).toBeNull()
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
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_2', metadata: {} }))
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns 500 when the RPC reports an error', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_fail' }))
    )
    supabase.rpc.mockResolvedValueOnce({ error: { message: 'db failure' } })

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Webhook handler failed')
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
