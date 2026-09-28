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

async function bootstrapDb() {
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
  ) {
    return db.query<{ applied: boolean }>(
      'SELECT public.apply_stripe_subscription_event($1::jsonb, $2::text, $3::bigint) AS applied',
      [JSON.stringify(subscription(id, created, status)), eventId, eventCreatedAt],
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

  it('records orphan paid subscriptions for refund instead of clobbering the live row', async () => {
    const db = await bootstrapDb()
    try {
      await db.query('INSERT INTO public.profiles (id, subscription_tier) VALUES ($1, NULL)', [userId])
      await apply(db, 'sub_live', 1700000000, 'active', 'evt_live', 1700001000)
      expect((await apply(db, 'sub_duplicate', 1700000001, 'active', 'evt_dup', 1700001100)).rows[0].applied).toBe(true)

      expect((await db.query<{ stripe_subscription_id: string }>(
        'SELECT stripe_subscription_id FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows[0].stripe_subscription_id).toBe('sub_live')

      const orphans = await db.query<{ stripe_subscription_id: string; needs_refund: boolean }>(
        'SELECT stripe_subscription_id, needs_refund FROM public.stripe_orphan_subscriptions WHERE user_id = $1',
        [userId],
      )
      expect(orphans.rows).toEqual([{ stripe_subscription_id: 'sub_duplicate', needs_refund: true }])

      await apply(db, 'sub_duplicate', 1700000001, 'active', 'evt_dup_retry', 1700001200)
      await apply(db, 'sub_old', 1699999999, 'canceled', 'evt_old_terminal', 1700001300)
      expect((await db.query('SELECT * FROM public.stripe_orphan_subscriptions WHERE user_id = $1', [userId])).rows).toHaveLength(1)
    } finally {
      await db.close()
    }
  })
})

describe('reserve_stripe_checkout migration (PGlite)', () => {
  it('fences checkout attempts and retires completed sessions', async () => {
    const db = await bootstrapDb()
    try {
      const reserve = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1') AS data`,
        [userId],
      )
      expect(reserve.rows[0].data.action).toBe('create')
      const firstKey = reserve.rows[0].data.idempotency_key

      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2, 'cs_live', 'https://checkout.test/cs_live', now() + interval '1 hour') AS finalized`,
        [userId, firstKey],
      )).rows[0].finalized).toBe(true)

      const tierChange = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2') AS data`,
        [userId],
      )
      expect(tierChange.rows[0].data.error).toBe('checkout_in_progress')

      const reuse = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1') AS data`,
        [userId],
      )
      expect(reuse.rows[0].data).toMatchObject({
        action: 'reuse',
        session_id: 'cs_live',
        url: 'https://checkout.test/cs_live',
      })

      expect((await db.query<{ completed: boolean }>(
        `SELECT public.complete_stripe_checkout_reservation($1::uuid, $2, 'cs_live', 'sub_paid') AS completed`,
        [userId, firstKey],
      )).rows[0].completed).toBe(true)
      expect((await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1') AS data`, [userId],
      )).rows[0].data.error).toBe('checkout_in_progress')

      await db.query('INSERT INTO public.profiles (id) VALUES ($1)', [userId])
      await db.query(
        `INSERT INTO public.subscriptions (user_id, platform, external_subscription_id, tier, status, stripe_subscription_id)
         VALUES ($1, 'stripe', 'sub_paid', 'tier1', 'canceled', 'sub_paid')`, [userId],
      )
      const next = (await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier2') AS data`, [userId],
      )).rows[0].data
      expect(next.action).toBe('create')
      expect(next.idempotency_key).not.toBe(firstKey)

      await db.query('SELECT public.release_stripe_checkout_reservation($1::uuid, $2)', [userId, firstKey])
      expect((await db.query<{ status: string; idempotency_key: string }>(
        'SELECT status, idempotency_key FROM public.stripe_checkout_reservations WHERE user_id = $1', [userId],
      )).rows[0]).toEqual({ status: 'pending', idempotency_key: next.idempotency_key })
      expect((await db.query<{ finalized: boolean }>(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, $2, 'cs_stale', 'https://checkout.test/cs_stale', now() + interval '1 hour') AS finalized`,
        [userId, firstKey],
      )).rows[0].finalized).toBe(false)
    } finally {
      await db.close()
    }
  })
})
