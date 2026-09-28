import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST as POSTHandler } from './stripe'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)
import type Stripe from 'stripe'

const mockRetrieve = vi.fn()

vi.mock('@/src/lib/stripe', () => ({
  validateWebhookSignature: vi.fn(),
  stripe: { subscriptions: { retrieve: (...args: unknown[]) => mockRetrieve(...args) } },
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { validateWebhookSignature } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'

const mockValidateWebhookSignature = vi.mocked(validateWebhookSignature)
const mockCreateAdminClient = vi.mocked(createAdminClient)

let nextEventId = 0
let nextEventCreated = 1700000000

function makeEvent(type: string, object: Record<string, unknown>, id?: string, created?: number) {
  nextEventId += 1
  nextEventCreated += 1
  const eventCreated = created ?? nextEventCreated
  return { id: id ?? `evt_${nextEventId}`, type, created: eventCreated, data: { object } } as unknown as Stripe.Event
}

/**
 * A fake "live Stripe" subscription, independent of what any event payload
 * claims. Current ("basil", 2025-03-31+) Stripe API shape: current_period_start/end
 * live on the first subscription item, not on the subscription itself.
 */
function liveSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    created: 1700000000,
    status: 'active',
    customer: 'cus_1',
    metadata: { userId: 'user-1', tier: 'tier1' },
    items: {
      data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }],
    },
    cancel_at_period_end: false,
    canceled_at: null,
    ...overrides,
  }
}

const TERMINAL = new Set(['canceled', 'incomplete_expired', 'unpaid'])
type Row = Record<string, unknown>

/**
 * Faithful in-memory emulation of public.apply_stripe_subscription_event
 * (supabase/migrations/20260928000000_record_stripe_subscription_created.sql).
 *
 * This sandbox has no Postgres/pglite to run the real SQL function. Since
 * the handler now always fetches *live* Stripe state before calling this
 * RPC, there is no event-time ordering to emulate - only: (1) exact-replay
 * dedup by event_id, (2) upsert by (user_id, platform) that only overwrites
 * a different subscription id's row when that row is terminal, (3) atomic
 * profile update requiring a matching profiles row.
 */
function buildSupabase() {
  const processedEventIds = new Set<string>()
  const subscriptions = new Map<string, Row>() // keyed by user_id
  const profiles = new Map<string, { subscription_tier: string | null }>([
    ['user-1', { subscription_tier: null }],
  ])

  function apply(
    p: Row,
    eventId: string,
    eventCreatedAt?: number,
  ): { error?: { message: string } } {
    const userId = p.user_id as string | undefined
    const stripeId = p.stripe_subscription_id as string
    const status = p.status as string
    const tier = (p.tier as string | undefined) || undefined
    const eventCreated = eventCreatedAt ?? 1700000000
    if (!userId || !stripeId) return {}

    if (processedEventIds.has(eventId)) return {} // exact replay: no-op success
    processedEventIds.add(eventId)

    const existing = subscriptions.get(userId)
    const guardPasses = !existing || existing.stripe_subscription_id === stripeId ||
      (TERMINAL.has(existing.status as string) &&
        (!existing.stripe_created_at || String(existing.stripe_created_at) < String(p.stripe_created_at)))
    if (!guardPasses) {
      return {}
    }

    if (
      existing &&
      existing.stripe_subscription_id === stripeId &&
      existing.stripe_last_event_created_at &&
      eventCreated <= Number(existing.stripe_last_event_created_at)
    ) {
      return {}
    }

    subscriptions.set(userId, { ...(existing ?? {}), ...p, stripe_last_event_created_at: eventCreated })

    const profile = profiles.get(userId)
    if (!profile) {
      if (existing) subscriptions.set(userId, existing)
      else subscriptions.delete(userId)
      processedEventIds.delete(eventId) // real transaction rollback undoes the dedup insert too
      return { error: { message: `Profile missing for Stripe subscription ${stripeId}` } }
    }
    profile.subscription_tier = TERMINAL.has(status) ? null : (tier ?? profile.subscription_tier)
    return {}
  }

  const rpc = vi.fn((name: string, args: { p_subscription: Row; p_event_id: string; p_event_created_at: number }) => {
    if (name === 'acquire_stripe_subscription_lease') {
      return Promise.resolve({ data: 'lease-token', error: null })
    }
    if (name === 'release_stripe_subscription_lease') {
      return Promise.resolve({ data: true, error: null })
    }
    if (name === 'consume_stripe_checkout') {
      return Promise.resolve({ data: true, error: null })
    }
    if (name !== 'apply_stripe_subscription_event') {
      return Promise.resolve({ error: new Error('Unknown RPC') })
    }
    return Promise.resolve(apply(args.p_subscription, args.p_event_id, args.p_event_created_at))
  })

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
    restoreProfile(userId: string) {
      profiles.set(userId, { subscription_tier: null })
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
    mockRetrieve.mockResolvedValue(liveSubscription())
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

  it('retires a completed checkout reservation', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('checkout.session.completed', {
        id: 'cs_1',
        subscription: 'sub_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledWith('consume_stripe_checkout', {
      p_user_id: 'user-1',
      p_checkout_session_id: 'cs_1',
      p_stripe_subscription_id: 'sub_1',
    })
  })

  it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])(
    'fetches the subscription\'s live state from Stripe for %s, never trusting the event payload',
    async (type) => {
      mockValidateWebhookSignature.mockResolvedValue(
        makeEvent(type, { id: 'sub_1', status: 'incomplete' }) // event payload claims a stale status
      )
      mockRetrieve.mockResolvedValue(liveSubscription({ status: 'active' })) // live truth says active

      const res = await POST(webhookRequest('{}', 'sig'))

      expect(res.status).toBe(200)
      expect(mockRetrieve).toHaveBeenCalledWith('sub_1')
      expect(supabase.rpc).toHaveBeenCalledWith('apply_stripe_subscription_event',
        expect.objectContaining({ p_payment_succeeded: false }))
      expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'active' })
      expect(supabase.getProfileTier('user-1')).toBe('tier1')
    }
  )

  it('reads current_period_start/end from the current items-based Stripe shape', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_1' }))
    mockRetrieve.mockResolvedValue(liveSubscription())

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({
      current_period_start: new Date(1700000000 * 1000).toISOString(),
      current_period_end: new Date(1702592000 * 1000).toISOString(),
    })
  })

  it('is idempotent when the exact same event is replayed, even though each replay still fetches Stripe', async () => {
    const event = makeEvent('customer.subscription.created', { id: 'sub_1' })
    mockValidateWebhookSignature.mockResolvedValue(event)

    const first = await POST(webhookRequest('{}', 'sig'))
    const second = await POST(webhookRequest('{}', 'sig'))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mockRetrieve).toHaveBeenCalledTimes(2) // still fetches live state each time
    expect(supabase.rpc).toHaveBeenCalledTimes(6)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
  })

  it('handles customer.subscription.deleted by writing whatever status Stripe currently reports', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.deleted', { id: 'sub_1' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ status: 'canceled', canceled_at: 1701000000 }))

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'canceled' })
    expect(supabase.getProfileTier('user-1')).toBeNull()
  })

  it('invoice.payment_succeeded and invoice.payment_failed are handled identically: both fetch and write live state', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('invoice.payment_succeeded', { parent: { subscription_details: { subscription: 'sub_1' } } }))
    mockRetrieve.mockResolvedValue(liveSubscription({ status: 'active' }))
    const succeeded = await POST(webhookRequest('{}', 'sig'))
    expect(succeeded.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('apply_stripe_subscription_event',
      expect.objectContaining({ p_payment_succeeded: true }))
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'active' })

    mockValidateWebhookSignature.mockResolvedValue(makeEvent('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_1' } } }))
    mockRetrieve.mockResolvedValue(liveSubscription({ status: 'past_due' }))
    const failed = await POST(webhookRequest('{}', 'sig'))
    expect(failed.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('apply_stripe_subscription_event',
      expect.objectContaining({ p_payment_succeeded: false }))
    expect(supabase.rowForUser('user-1')).toMatchObject({ status: 'past_due' })
  })

  it('handles invoice events with an expanded subscription object, not just an id string', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { parent: { subscription_details: { subscription: { id: 'sub_1' } } } })
    )

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(mockRetrieve).toHaveBeenCalledWith('sub_1')
  })

  it('reads the subscription id from the current parent.subscription_details shape (id string)', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { parent: { subscription_details: { subscription: 'sub_1' } } })
    )

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(mockRetrieve).toHaveBeenCalledWith('sub_1')
  })

  it('reads the subscription id from the current parent.subscription_details shape (expanded object)', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('invoice.payment_succeeded', { parent: { subscription_details: { subscription: { id: 'sub_1' } } } })
    )

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(mockRetrieve).toHaveBeenCalledWith('sub_1')
  })

  it('handles invoice events without a subscription by skipping Stripe and the RPC entirely', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('invoice.payment_succeeded', { parent: null }))
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('resubscribe: a newer subscription id replaces a canceled row for the same user', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_old' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_old', created: 1700000000 }))
    await POST(webhookRequest('{}', 'sig'))

    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.deleted', { id: 'sub_old' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_old', created: 1700000000, status: 'canceled' }))
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('canceled')

    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_new' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_new', created: 1700000001, status: 'active' }))
    const resubscribe = await POST(webhookRequest('{}', 'sig'))

    expect(resubscribe.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'active' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed'])(
    'does not replace a newer canceled subscription with a delayed older %s event',
    async (type) => {
      for (const [id, created] of [['sub_old', 1700000000], ['sub_new', 1700000001]] as const) {
        mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.deleted', { id }))
        mockRetrieve.mockResolvedValue(liveSubscription({ id, created, status: 'canceled' }))
        expect((await POST(webhookRequest('{}', 'sig'))).status).toBe(200)
      }

      const object = type.startsWith('invoice.')
        ? { parent: { subscription_details: { subscription: 'sub_old' } } }
        : { id: 'sub_old' }
      mockValidateWebhookSignature.mockResolvedValue(makeEvent(type, object))
      mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_old', created: 1700000000, status: 'canceled' }))

      expect((await POST(webhookRequest('{}', 'sig'))).status).toBe(200)
      expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_new', status: 'canceled' })
      expect(supabase.getProfileTier('user-1')).toBeNull()
    }
  )

  it('defense in depth: an event for a different subscription id is dropped while the existing row is still non-terminal', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_a' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_a', status: 'past_due' }))
    await POST(webhookRequest('{}', 'sig'))
    expect(supabase.rowForUser('user-1')?.status).toBe('past_due')

    // create-checkout.ts already blocks starting a second checkout while
    // any non-terminal subscription exists; this proves the RPC also
    // refuses such a write if one somehow occurs (e.g. an out-of-band
    // Stripe-side subscription).
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.updated', { id: 'sub_b' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_b', status: 'active' }))
    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_a', status: 'past_due' })
  })

  it('skips when the live subscription is missing metadata', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_2' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_2', metadata: {} }))

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(200)
    expect(supabase.rpc).not.toHaveBeenCalledWith('apply_stripe_subscription_event', expect.anything())
    expect(supabase.rpc).toHaveBeenCalledWith('release_stripe_subscription_lease', {
      p_stripe_subscription_id: 'sub_2', p_lease_token: 'lease-token',
    })
  })

  it('returns retryable failure on lease contention before retrieving Stripe state', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.updated', { id: 'sub_1' }))
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(500)
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('acquire_stripe_subscription_lease', {
      p_stripe_subscription_id: 'sub_1',
    })
  })

  it('returns 500 when the RPC reports an error', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.subscription.created', { id: 'sub_fail' }))
    mockRetrieve.mockResolvedValue(liveSubscription({ id: 'sub_fail' }))
    supabase.rpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'db failure' } }))

    const res = await POST(webhookRequest('{}', 'sig'))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Webhook handler failed')
  })

  it('returns 500 and persists no subscription row when the profile is missing, and reprocesses on retry once fixed', async () => {
    supabase.deleteProfile('user-1')
    const event = makeEvent('customer.subscription.created', { id: 'sub_1' })
    mockValidateWebhookSignature.mockResolvedValue(event)

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Webhook handler failed')
    expect(supabase.hasAnyRow()).toBe(false)

    supabase.restoreProfile('user-1')
    mockValidateWebhookSignature.mockResolvedValue(event)
    const retry = await POST(webhookRequest('{}', 'sig'))

    expect(retry.status).toBe(200)
    expect(supabase.rowForUser('user-1')).toMatchObject({ stripe_subscription_id: 'sub_1' })
    expect(supabase.getProfileTier('user-1')).toBe('tier1')
  })

  it('returns 200 for unhandled event types', async () => {
    mockValidateWebhookSignature.mockResolvedValue(makeEvent('customer.created', { id: 'cus_new' }))

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it('requests retry when checkout completion metadata is missing', async () => {
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('checkout.session.completed', { id: 'cs_2', metadata: {} })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(500)
  })

  it('requests retry when checkout completion has no matching reservation', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: false, error: null })
    mockValidateWebhookSignature.mockResolvedValue(
      makeEvent('checkout.session.completed', {
        id: 'cs_unknown', subscription: 'sub_1', metadata: { userId: 'user-1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(500)
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
