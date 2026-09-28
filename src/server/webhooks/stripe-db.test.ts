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
    } finally {
      await db.close()
    }
  })
})

describe('reserve_stripe_checkout migration (PGlite)', () => {
  it('reuses an open checkout session for the same user and tier', async () => {
    const db = await bootstrapDb()
    try {
      const reserve = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', 'key-a') AS data`,
        [userId],
      )
      expect(reserve.rows[0].data.action).toBe('create')

      await db.query(
        `SELECT public.finalize_stripe_checkout_reservation($1::uuid, 'cs_live', 'https://checkout.test/cs_live', now() + interval '1 hour')`,
        [userId],
      )

      const reuse = await db.query<{ data: Record<string, string> }>(
        `SELECT public.reserve_stripe_checkout($1::uuid, 'tier1', 'key-b') AS data`,
        [userId],
      )
      expect(reuse.rows[0].data).toMatchObject({
        action: 'reuse',
        session_id: 'cs_live',
        url: 'https://checkout.test/cs_live',
      })
    } finally {
      await db.close()
    }
  })
})
