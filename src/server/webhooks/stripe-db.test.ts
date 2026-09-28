// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260928000000_record_stripe_subscription_created.sql', import.meta.url),
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

describe('apply_stripe_subscription_event migration', () => {
  it('rolls back profile failures and keeps newer subscriptions after delayed events', async () => {
    const db = new PGlite()
    try {
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
          current_period_start timestamptz,
          current_period_end timestamptz,
          cancel_at_period_end boolean,
          canceled_at timestamptz,
          updated_at timestamptz,
          UNIQUE (user_id, platform)
        );
      `)
      await db.exec(migration)

      async function apply(id: string, created: number, status: string, eventId: string) {
        return db.query<{ applied: boolean }>(
          'SELECT public.apply_stripe_subscription_event($1::jsonb, $2::text) AS applied',
          [JSON.stringify(subscription(id, created, status)), eventId],
        )
      }

      await expect(apply('sub_old', 1700000000, 'active', 'evt_missing_profile'))
        .rejects.toThrow(/Profile missing/)
      expect((await db.query('SELECT * FROM public.subscriptions')).rows).toEqual([])
      expect((await db.query('SELECT * FROM public.stripe_webhook_events')).rows).toEqual([])

      await db.query('INSERT INTO public.profiles (id, subscription_tier) VALUES ($1, NULL)', [userId])
      expect((await apply('sub_old', 1700000000, 'active', 'evt_missing_profile')).rows[0].applied).toBe(true)
      expect((await db.query<{ subscription_tier: string }>('SELECT subscription_tier FROM public.profiles WHERE id = $1', [userId])).rows[0].subscription_tier).toBe('tier1')

      await apply('sub_old', 1700000000, 'canceled', 'evt_old_canceled')
      await apply('sub_new', 1700000001, 'active', 'evt_new_active')
      await apply('sub_new', 1700000001, 'canceled', 'evt_new_canceled')
      expect((await apply('sub_old', 1700000000, 'canceled', 'evt_old_delayed')).rows[0].applied).toBe(false)

      expect((await db.query<{ stripe_subscription_id: string; status: string }>(
        'SELECT stripe_subscription_id, status FROM public.subscriptions WHERE user_id = $1', [userId],
      )).rows).toEqual([{ stripe_subscription_id: 'sub_new', status: 'canceled' }])
      expect((await db.query<{ subscription_tier: string | null }>(
        'SELECT subscription_tier FROM public.profiles WHERE id = $1', [userId],
      )).rows[0].subscription_tier).toBeNull()
    } finally {
      await db.close()
    }
  })
})
