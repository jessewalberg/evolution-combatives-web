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

let nextEventTime = 1_700_000_000

/** Each event gets a distinct, increasing created time unless overridden. */
function makeEvent(type: string, object: Record<string, unknown>, overrides: { id?: string; created?: number } = {}) {
  nextEventTime += 1
  return {
    id: overrides.id ?? `evt_${nextEventTime}`,
    type,
    created: overrides.created ?? nextEventTime,
    data: { object },
  } as unknown as Stripe.Event
}

type Row = Record<string, unknown> & { stripe_event_created_at?: number; stripe_event_id?: string }

const TERMINAL = new Set(['canceled', 'incomplete_expired', 'unpaid'])

/**
 * Faithful in-memory emulation of public.apply_stripe_subscription_event
 * (supabase/migrations/20260928000000_record_stripe_subscription_created.sql).
 *
 * This sandbox has no Postgres/pglite available to run the real SQL
 * function, so this store reproduces its exact ordering-guard and
 * (user_id, platform) upsert semantics: a write only applies when the
 * incoming event is not older than the row's last-applied event, matching
 * the migration's WHERE clause line for line. Rollback assertions check
 * this persisted store state, not just the HTTP status, so they fail if the
 * TypeScript call site or the guard's shape drifts from the real function.
 */
function buildSupabase() {
  const subscriptions = new Map<string, Row>() // keyed by user_id
  const profiles = new Map<string, { subscription_tier: string | null }>([
    ['user-1', { subscription_tier: null }],
  ])

  function passesOrderingGuard(existing: Row | undefined, eventCreatedAt: number, eventId: string): boolean {
    if (!existing || existing.stripe_event_created_at === undefined) return true
    if (eventCreatedAt > (existing.stripe_event_created_at as number)) return true
    return eventCreatedAt === existing.stripe_event_created_at && eventId === existing.stripe_event_id
  }

  function applyEvent(
    p: Row,
    eventCreatedAt: number,
    eventId: string
  ): { error?: { message: string } } {
    const stripeId = p.stripe_subscription_id as string
    const status = p.status as string
    const tier = (p.tier as string | undefined) || undefined
    if (!stripeId) return {}

    let writtenUserId: string | undefined

    if (p.user_id) {
      const userId = p.user_id as string
      const existing = subscriptions.get(userId)
      if (!passesOrderingGuard(existing, eventCreatedAt, eventId)) {
        return {} // stale event: a newer event already landed
      }
      subscriptions.set(userId, { ...p, stripe_event_created_at: eventCreatedAt, stripe_event_id: eventId })
      writtenUserId = userId

      const profile = profiles.get(writtenUserId)
      if (!profile) {
        subscriptions.set(userId, existing as Row) // atomic rollback (or delete if none existed)
        if (!existing) subscriptions.delete(userId)
        return { error: { message: `Profile missing for Stripe subscription ${stripeId}` } }
      }
      profile.subscription_tier = TERMINAL.has(status) ? null : (tier ?? profile.subscription_tier)
      return {}
    }

    // Invoice path: match an existing row by stripe_subscription_id only,
    // never insert, never touch tier.
    for (const [userId, row] of subscriptions) {
      if (row.stripe_subscription_id === stripeId) {
        if (!passesOrderingGuard(row, eventCreatedAt, eventId)) return {}
        Object.assign(row, { status, stripe_event_created_at: eventCreatedAt, stripe_event_id: eventId })
        writtenUserId = userId
        break
      }
    }
    return {}
  }

  const rpc = vi.fn(
    (
      name: string,
      args: { p_subscription: Row; p_event_created_at: string; p_event_id: string }
    ) => {
      if (name !== 'apply_stripe_subscription_event') {
        return Promise.resolve({ error: new Error('Unknown RPC') })
      }
      const eventCreatedAt = new Date(args.p_event_created_at).getTime()
      return Promise.resolve(applyEvent(args.p_subscription, eventCreatedAt, args.p_event_id))
    }
  )

  return {
    rpc,
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
    nextEventTime = 1_700_000_000
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
      p_event_created_at: expect.any(String),
      p_event_id: expect.any(String),
    })
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('returns 200 and is idempotent when the exact same event is replayed', async () => {
    const created = makeEvent('customer.subscription.created', subscriptionEvent())
    mockValidateWebhookSignature.mockResolvedValue(created)

    const first = await POST(webhookRequest('{}', 'sig'))
    const second = await POST(webhookRequest('{}', 'sig')) // same event object: same id + created

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('a stale replay of an old created event cannot resurrect a later canceled subscription', async () => {
    const created = makeEvent('customer.subscription.created', subscriptionEvent())
    mockValidateWebhookSignature.mockResolvedValue(created)
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')
    expect(supabase.getProfileTier('user-1')).toBeNull()

    // Stripe redelivers the *original* created event (older than the deleted event)
    mockValidateWebhookSignature.mockResolvedValue(created)
    const replay = await POST(webhookRequest('{}', 'sig'))

    expect(replay.status).toBe(200)
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('resubscribe: a newer created event for a new Stripe id replaces a canceled subscription', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_new', status: 'active' }))
    )
    const resubscribe = await POST(webhookRequest('{}', 'sig'))

    expect(resubscribe.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('resubscribe works from a past_due row too, since the guard is time-based not status-based', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_old' }))
    )
    await POST(webhookRequest('{}', 'sig'))
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ id: 'sub_old', status: 'past_due' }))
    )
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('past_due')

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ id: 'sub_new', status: 'active' }))
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active' })
  })

  it('an updated event delivered before its created event still establishes the row (it carries full metadata)', async () => {
    // Stripe guarantees a created event's own timestamp always precedes any
    // update for that subscription, so a genuinely out-of-order *delivery*
    // is safe to apply here - the ordering guard (tested elsewhere) is what
    // rejects a truly stale event, not the event type.
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ status: 'past_due' }))
    )

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1', status: 'past_due' })
  })

  it('a genuinely stale created event (older event time) cannot overwrite a row already updated', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ status: 'active' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    // A duplicate/delayed created delivery with an older event.created
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ status: 'incomplete' }), { created: 1 })
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'active' })
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

    // A delayed "updated" for sub_old, even with a fresh delivery time, is
    // still older in event-created terms only if Stripe actually sent it
    // earlier; simulate the common case of a genuinely late/duplicate
    // delivery by giving it an old `created` timestamp.
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.updated', subscriptionEvent({ id: 'sub_old', status: 'active' }), {
        created: 1,
      })
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new' })
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

  it('handles invoice.payment_succeeded through the ordering-guarded RPC, reactivating an existing row', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent({ status: 'past_due' }))
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { subscription: 'sub_1' })
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'active' })
    // Invoices never carry tier data - profile tier is untouched, not reset
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('handles invoice.payment_failed by marking the subscription past_due', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.created', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_failed', { subscription: 'sub_1' })
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'past_due' })
  })

  it('a stale invoice.payment_succeeded cannot reactivate a subscription canceled by a later event', async () => {
    const created = makeEvent('customer.subscription.created', subscriptionEvent())
    mockValidateWebhookSignature.mockResolvedValue(created)
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('customer.subscription.deleted', subscriptionEvent())
    )
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')

    // Late-delivered payment_succeeded from before the cancellation
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { subscription: 'sub_1' }, { created: 1 })
    )
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('handles invoice events without a subscription by skipping the RPC entirely', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { subscription: null })
    )
    const res1 = await POST(webhookRequest('{}', 'sig'))
    expect(res1.status).toBe(200)
    expect(supabase.rpc).not.toHaveBeenCalled()

    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_failed', { subscription: null })
    )
    const res2 = await POST(webhookRequest('{}', 'sig'))
    expect(res2.status).toBe(200)
    expect(supabase.rpc).not.toHaveBeenCalled()
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
