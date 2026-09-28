// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migrationBase = readFileSync(
  new URL('../../../supabase/migrations/20260928000000_record_stripe_subscription_created.sql', import.meta.url),
  'utf8',
)
const migrationCheckout = readFileSync(
  new URL('../../../supabase/migrations/20260928120000_stripe_checkout_reservation_monotonic_events.sql', import.meta.url),
  'utf8',
)

const userId = '8c74d964-522a-499e-adf2-312491c727a8'

function subscription(id: string, created: number, status: string) {
  return {
    user_id: userId,
    tier: 'tier1',
    external_subscription_id: id,
    stripe_subscription_id: id,
    stripe_created_at: new Date(created * 1000).toISOString(),
    status,
  }
}

async function bootstrapDb(legacyCreatedAt?: string) {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, subscription_tier text);
    CREATE TABLE public.subscriptions (
      user_id uuid NOT NULL,
      platform text NOT NULL,
      external_subscription_id text NOT NULL,
      tier text NOT NULL,
      status text NOT NULL,
      stripe_subscription_id text UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      stripe_customer_id text,
      stripe_created_at timestamptz,
      stripe_last_event_created_at timestamptz,
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean,
      canceled_at timestamptz,
      updated_at timestamptz,
      UNIQUE (user_id, platform)
    );
  `)
  await db.exec(migrationBase)
  if (legacyCreatedAt) {
    await db.query(
      `INSERT INTO public.subscriptions (user_id, platform, external_subscription_id, tier, status, stripe_subscription_id, created_at)
       VALUES ($1, 'stripe', 'sub_legacy', 'tier1', 'active', 'sub_legacy', $2)`,
      [userId, legacyCreatedAt],
    )
  }
  await db.exec(migrationCheckout)
  return db
}

describe('apply_stripe_subscription_event migration (PGlite)', () => {
  async function apply(
    db: PGlite,
    id: string,
    created: number,
    status: string,
    eventId: string,
    eventCreatedAt: number,
    paymentSucceeded = false,
  ) {
    return db.query<{ applied: boolean }>(
      'SELECT public.apply_stripe_subscription_event($1::jsonb, $2::text, $3::bigint, $4::boolean) AS applied',
      [JSON.stringify(subscription(id, created, status)), eventId, eventCreatedAt, paymentSucceeded],
    )
  }

  it('rolls back profile failures and keeps newer subscriptions after delayed events', async () => {
    const db = await bootstrapDb()
    try {
      await expect(apply(db, 'sub_old', 1700000000, 'active', 'evt_missing_profile', 1700000100))
        .rejects.toThrow(/Profile missing/)
      expect((await db.query('SELECT * FROM public.subscriptions')).rows).toEqual([])
      expect((await db.query('SELECT * FROM public.stripe_webhook_events')).rows).toEqual([])

      await db.query('INSERT INTO public.profiles (id, subscription_tier) VALUES ($1, NULL)', [userId])
      expect((await apply(db, 'sub_old', 1700000000, 'active', 'evt_missing_profile', 1700000100)).rows[0].applied).toBe(true)
      expect((await db.query<{ subscription_tier: string }>('SELECT subscription_tier FROM public.profiles WHERE id = $1', [userId])).rows[0].subscription_tier).toBe('tier1')

      await apply(db, 'sub_old', 1700000000, 'canceled', 'evt_old_canceled', 1700000200)
      await apply(db, 'sub_new', 1700000001, 'active', 'evt_new_active', 1700000300)
      await apply(db, 'sub_new', 1700000001, 'canceled', 'evt_new_canceled', 1700000400)
      expect((await apply(db, 'sub_old', 1700000000, 'canceled', 'evt_old_delayed', 1700000150)).rows[0].applied).toBe(false)

      expect((await db.query<{ stripe_subscription_id: string; status: string }>(
        'SELECT stripe_subscription_id, status FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows).toEqual([{ stripe_subscription_id: 'sub_new', status: 'canceled' }])
    } finally {
      await db.close()
    }
  })

  it('does not let a stale event re-activate a subscription on the same Stripe id', async () => {
    const db = await bootstrapDb()
    try {
      await db.query('INSERT INTO public.profiles (id, subscription_tier) VALUES ($1, NULL)', [userId])
      await apply(db, 'sub_1', 1700000000, 'active', 'evt_active', 1700001000)
      await apply(db, 'sub_1', 1700000000, 'canceled', 'evt_canceled', 1700002000)
      expect((await apply(db, 'sub_1', 1700000000, 'active', 'evt_stale_active', 1700001500)).rows[0].applied).toBe(false)

      expect((await db.query<{ status: string; stripe_last_event_created_at: Date }>(
        'SELECT status, stripe_last_event_created_at FROM public.subscriptions WHERE user_id = $1',
        [userId],
      )).rows[0].status).toBe('canceled')
    } finally {
      await db.close()
    }
  })

  it('upgrades one orphan row to refundable only after payment succeeds', async () => {
    const db = await bootstrapDb()
    try {
      await db.query('INSERT INTO public.profiles (id, subscription_tier) VALUES ($1, NULL)', [userId])
      await apply(db, 'sub_live', 1700000000, 'active', 'evt_live', 1700001000)
      expect((await apply(db, 'sub_duplicate', 1700000001, 'trialing', 'evt_dup', 1700001100)).rows[0].applied).toBe(true)

      expect((await db.query<{ stripe_subscription_id: string }>(
        'SELECT stripe_subscription_id FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows[0].stripe_subscription_id).toBe('sub_live')

      const orphans = await db.query<{ stripe_subscription_id: string; needs_refund: boolean }>(
        'SELECT stripe_subscription_id, needs_refund FROM public.stripe_orphan_subscriptions WHERE user_id = $1',
        [userId],
      )
      expect(orphans.rows).toEqual([{ stripe_subscription_id: 'sub_duplicate', needs_refund: false }])

      await apply(db, 'sub_duplicate', 1700000001, 'incomplete', 'evt_dup_retry', 1700001200)
      expect((await db.query<{ needs_refund: boolean }>(
        'SELECT needs_refund FROM public.stripe_orphan_subscriptions WHERE stripe_subscription_id = $1', ['sub_duplicate'],
      )).rows[0].needs_refund).toBe(false)
      await apply(db, 'sub_live', 1700000000, 'active', 'evt_live_updated', 1700001300)
      await apply(db, 'sub_duplicate', 1700000001, 'active', 'evt_paid', 1700001250, true)
      await apply(db, 'sub_duplicate', 1700000001, 'active', 'evt_updated', 1700001275)
      await apply(db, 'sub_old', 1699999999, 'canceled', 'evt_old_terminal', 1700001300)
      expect((await db.query<{ stripe_subscription_id: string; needs_refund: boolean; event_id: string }>(
        'SELECT stripe_subscription_id, needs_refund, event_id FROM public.stripe_orphan_subscriptions WHERE user_id = $1 ORDER BY stripe_subscription_id',
        [userId],
      )).rows).toEqual([
        { stripe_subscription_id: 'sub_duplicate', needs_refund: true, event_id: 'evt_paid' },
        { stripe_subscription_id: 'sub_old', needs_refund: false, event_id: 'evt_old_terminal' },
      ])

      await apply(db, 'sub_live', 1700000000, 'canceled', 'evt_live_canceled', 1700001400)
      await apply(db, 'sub_fresh', 1700000002, 'active', 'evt_fresh', 1700001500)
      expect((await db.query('SELECT * FROM public.stripe_orphan_subscriptions WHERE user_id = $1', [userId])).rows).toHaveLength(2)
      expect((await db.query<{ stripe_subscription_id: string }>(
        'SELECT stripe_subscription_id FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows[0].stripe_subscription_id).toBe('sub_fresh')
    } finally {
      await db.close()
    }
  })

  it('does not treat a delayed historical payment as a new refund', async () => {
    const db = await bootstrapDb()
    try {
      await db.query('INSERT INTO public.profiles (id) VALUES ($1)', [userId])
      await apply(db, 'sub_old', 1700000000, 'active', 'evt_old_active', 1700000100)
      await apply(db, 'sub_old', 1700000000, 'canceled', 'evt_old_canceled', 1700000200)
      await apply(db, 'sub_new', 1700000300, 'active', 'evt_new_active', 1700000300)
      await apply(db, 'sub_old', 1700000000, 'canceled', 'evt_old_delayed', 1700000150)
      await apply(db, 'sub_old', 1700000000, 'canceled', 'evt_old_payment', 1700000250, true)

      expect((await db.query<{ stripe_subscription_id: string; needs_refund: boolean }>(
        'SELECT stripe_subscription_id, needs_refund FROM public.stripe_orphan_subscriptions WHERE user_id = $1',
        [userId],
      )).rows).toEqual([{ stripe_subscription_id: 'sub_old', needs_refund: false }])

      await apply(db, 'sub_new', 1700000300, 'canceled', 'evt_new_canceled', 1700000400)
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )).rows[0].data.action).toBe('create')
    } finally {
      await db.close()
    }
  })

  it('backfills legacy Stripe creation time and flags a later paid duplicate', async () => {
    const legacyCreatedAt = new Date(1700000000 * 1000).toISOString()
    const db = await bootstrapDb(legacyCreatedAt)
    try {
      const backfilledAt = (await db.query<{ stripe_created_at: string }>(
        'SELECT stripe_created_at FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows[0].stripe_created_at
      expect(new Date(backfilledAt).getTime()).toBe(new Date(legacyCreatedAt).getTime())

      await apply(db, 'sub_duplicate', 1700000100, 'active', 'evt_duplicate_paid', 1700000200, true)
      expect((await db.query<{ needs_refund: boolean }>(
        'SELECT needs_refund FROM public.stripe_orphan_subscriptions WHERE stripe_subscription_id = $1',
        ['sub_duplicate'],
      )).rows[0].needs_refund).toBe(true)

      await db.query(`UPDATE public.subscriptions SET status = 'canceled' WHERE user_id = $1`, [userId])
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )).rows[0].data.error).toBe('unresolved_payment')
      await db.query(`UPDATE public.stripe_orphan_subscriptions SET resolved_at = now() WHERE stripe_subscription_id = 'sub_duplicate'`)
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )).rows[0].data.action).toBe('create')
    } finally {
      await db.close()
    }
  })
})

describe('reserve_stripe_checkout migration (PGlite)', () => {
  it('reuses only an exact price and callback request', async () => {
    const db = await bootstrapDb()
    try {
      const web = JSON.stringify(['price_1', 'https://web.test/success', 'https://web.test/cancel'])
      const first = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, web],
      )).rows[0].data
      expect(first.action).toBe('create')
      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_web', 'https://checkout.test/web', now() + interval '1 hour') AS finalized`,
        [userId, first.reservation_id],
      )).rows[0].finalized).toBe(true)

      for (const changed of [
        JSON.stringify(['price_1', 'evolutioncombatives://subscription/success', 'evolutioncombatives://subscription/cancel']),
        JSON.stringify(['price_2', 'https://web.test/success', 'https://web.test/cancel']),
        JSON.stringify(['price_1', 'https://web.test/other-success', 'https://web.test/cancel']),
        JSON.stringify(['price_1', 'https://web.test/success', 'https://web.test/other-cancel']),
      ]) {
        const result = (await db.query<{ data: Record<string, string> }>(
          `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, changed],
        )).rows[0].data
        expect(result.error).toBe('checkout_in_progress')
      }

      const retry = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, web],
      )).rows[0].data
      expect(retry).toMatchObject({
        action: 'reuse', reservation_id: first.reservation_id, session_id: 'cs_web', url: 'https://checkout.test/web',
      })
      expect((await db.query<{ reservation_id: string; request_fingerprint: string }>(
        'SELECT reservation_id, request_fingerprint FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows).toEqual([{ reservation_id: first.reservation_id, request_fingerprint: web }])
    } finally {
      await db.close()
    }
  })

  it('refuses a web request while a mobile session is payable', async () => {
    const db = await bootstrapDb()
    try {
      const mobile = JSON.stringify(['price_1', 'evolutioncombatives://subscription/success', 'evolutioncombatives://subscription/cancel'])
      const web = JSON.stringify(['price_1', 'https://web.test/success', 'https://web.test/cancel'])
      const first = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, mobile],
      )).rows[0].data
      expect(first.action).toBe('create')
      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_mobile', 'https://checkout.test/mobile', now() + interval '1 hour') AS finalized`,
        [userId, first.reservation_id],
      )).rows[0].finalized).toBe(true)
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, web],
      )).rows[0].data.error).toBe('checkout_in_progress')
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', $2::text) AS data`, [userId, mobile],
      )).rows[0].data).toMatchObject({ action: 'reuse', reservation_id: first.reservation_id, session_id: 'cs_mobile' })
    } finally {
      await db.close()
    }
  })

  it('fences checkout attempts and retires completed sessions', async () => {
    const db = await bootstrapDb()
    try {
      const reserve = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', 'request-1') AS data`,
        [userId],
      )
      expect(reserve.rows[0].data.action).toBe('create')
      const firstReservationId = reserve.rows[0].data.reservation_id
      expect(reserve.rows[0].data.idempotency_key).toBe(`checkout:${firstReservationId}`)

      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2, 'cs_live', 'https://checkout.test/cs_live', now() + interval '1 hour') AS finalized`,
        [userId, firstReservationId],
      )).rows[0].finalized).toBe(true)

      const tierChange = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`,
        [userId],
      )
      expect(tierChange.rows[0].data.error).toBe('checkout_in_progress')

      await db.query(
        `SELECT public.release_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_other')`,
        [userId, firstReservationId],
      )

      const reuse = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', 'request-1') AS data`,
        [userId],
      )
      expect(reuse.rows[0].data).toMatchObject({
        action: 'reuse',
        reservation_id: firstReservationId,
        session_id: 'cs_live',
        url: 'https://checkout.test/cs_live',
      })
      const storedExpiry = (await db.query<{ expires_at: string }>(
        'SELECT expires_at FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0].expires_at
      expect(new Date(reuse.rows[0].data.expires_at).getTime()).toBe(new Date(storedExpiry).getTime())

      expect((await db.query<{ completed: boolean }>(
        `SELECT public.consume_stripe_checkout($1::uuid, 'cs_unknown', 'sub_paid') AS completed`,
        [userId],
      )).rows[0].completed).toBe(false)
      expect((await db.query('SELECT * FROM public.stripe_checkout_completions')).rows).toHaveLength(0)

      expect((await db.query<{ completed: boolean }>(
        `SELECT public.consume_stripe_checkout($1::uuid, 'cs_live', 'sub_paid') AS completed`,
        [userId],
      )).rows[0].completed).toBe(true)
      expect((await db.query<{ completed: boolean }>(
        `SELECT public.consume_stripe_checkout($1::uuid, 'cs_live', 'sub_other') AS completed`,
        [userId],
      )).rows[0].completed).toBe(false)
      expect((await db.query<{ completed: boolean }>(
        `SELECT public.consume_stripe_checkout($1::uuid, 'cs_live', 'sub_paid') AS completed`,
        [userId],
      )).rows[0].completed).toBe(true)
      expect((await db.query('SELECT * FROM public.stripe_checkout_completions')).rows).toHaveLength(1)
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', 'request-1') AS data`, [userId],
      )).rows[0].data.error).toBe('checkout_in_progress')

      await db.query('INSERT INTO public.profiles (id) VALUES ($1)', [userId])
      await db.query(
        `INSERT INTO public.subscriptions (user_id, platform, external_subscription_id, tier, status, stripe_subscription_id)
         VALUES ($1, 'stripe', 'sub_paid', 'tier1', 'canceled', 'sub_paid')`, [userId],
      )
      const next = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )).rows[0].data
      expect(next.action).toBe('create')
      expect(next.reservation_id).not.toBe(firstReservationId)
      expect(next.idempotency_key).toBe(`checkout:${next.reservation_id}`)

      await db.query('SELECT public.release_stripe_checkout_reservation($1::uuid, $2::uuid, NULL)', [userId, firstReservationId])
      expect((await db.query<{ status: string; reservation_id: string }>(
        'SELECT status, reservation_id FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0]).toEqual({ status: 'pending', reservation_id: next.reservation_id })
      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2, 'cs_stale', 'https://checkout.test/cs_stale', now() + interval '1 hour') AS finalized`,
        [userId, firstReservationId],
      )).rows[0].finalized).toBe(false)
      expect((await db.query<{ completed: boolean }>(
        `SELECT public.consume_stripe_checkout($1::uuid, 'cs_live', 'sub_paid') AS completed`,
        [userId],
      )).rows[0].completed).toBe(true)
      expect((await db.query<{ status: string }>(
        'SELECT status FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0].status).toBe('pending')

      await db.query(
        `SELECT public.release_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_created_but_not_finalized')`,
        [userId, next.reservation_id],
      )
      expect((await db.query<{ status: string }>(
        'SELECT status FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0].status).toBe('released')

      const third = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )).rows[0].data
      expect(third.reservation_id).not.toBe(next.reservation_id)
      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_third', 'https://checkout.test/cs_third', now() + interval '1 hour') AS finalized`,
        [userId, third.reservation_id],
      )).rows[0].finalized).toBe(true)
      await db.query(
        `SELECT public.release_stripe_checkout_reservation($1::uuid, $2::uuid, 'cs_third')`,
        [userId, third.reservation_id],
      )
      expect((await db.query<{ status: string }>(
        'SELECT status FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0].status).toBe('released')
    } finally {
      await db.close()
    }
  })

  it('blocks checkout until a paid orphan is resolved', async () => {
    const db = await bootstrapDb()
    try {
      await db.query('INSERT INTO public.profiles (id) VALUES ($1)', [userId])
      await db.query(
        `SELECT public.apply_stripe_subscription_event($1::jsonb, 'evt_primary', 1700001000, false)`,
        [JSON.stringify(subscription('sub_primary', 1700000000, 'active'))],
      )
      await db.query(
        `SELECT public.apply_stripe_subscription_event($1::jsonb, 'evt_orphan', 1700001100, true)`,
        [JSON.stringify(subscription('sub_orphan', 1700000001, 'active'))],
      )
      await db.query(
        `SELECT public.apply_stripe_subscription_event($1::jsonb, 'evt_canceled', 1700001200, false)`,
        [JSON.stringify(subscription('sub_primary', 1700000000, 'canceled'))],
      )

      const blocked = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )
      expect(blocked.rows[0].data.error).toBe('unresolved_payment')
      expect((await db.query('SELECT * FROM public.stripe_checkout_reservations')).rows).toHaveLength(0)

      await db.query(
        `UPDATE public.stripe_orphan_subscriptions SET resolved_at = now() WHERE stripe_subscription_id = 'sub_orphan'`,
      )
      const allowed = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2', 'request-1') AS data`, [userId],
      )
      expect(allowed.rows[0].data.action).toBe('create')
    } finally {
      await db.close()
    }
  })
})
