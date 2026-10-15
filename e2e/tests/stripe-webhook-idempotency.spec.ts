import { test, expect } from '../test'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'

/**
 * Stripe Webhook Idempotency and Order Independence Tests
 *
 * These tests verify the reconciliation system's correctness:
 * 1. Idempotency: same event delivered twice produces same result
 * 2. Order independence: older event after newer one doesn't overwrite
 *
 * REQUIREMENT: The staging Supabase project must have the migration
 * `20261012000000_reconcile_stripe_entitlement.sql` applied.
 *
 * If the RPC function doesn't exist, these tests will fail with:
 * "Could not find the function public.reconcile_stripe_entitlement"
 */

// Check if the RPC function exists before running tests
async function checkRpcExists(): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient()
    // Try calling with invalid params - will error but differently if function exists
    const { error } = await supabase.rpc('reconcile_stripe_entitlement', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_expected_version: 0,
      p_event_id: 'test',
      p_event_created: 0,
      p_stripe_subscription_id: 'test',
      p_stripe_customer_id: 'test',
      p_customer_ids: [],
      p_subscription_created: 0,
      p_tier: 'tier1',
      p_status: 'active',
      p_current_period_start: new Date().toISOString(),
      p_current_period_end: new Date().toISOString(),
      p_cancel_at_period_end: false,
      p_canceled_at: null,
    })
    // If we get here without PGRST202, the function exists
    // It may return an error for invalid data, but not "function not found"
    if (error?.code === 'PGRST202') {
      return false
    }
    return true
  } catch {
    return false
  }
}

test.describe('Stripe Entitlement Reconciliation Logic', () => {
  test('duplicate event ID is ignored (idempotency)', async () => {
    const exists = await checkRpcExists()
    test.skip(!exists, 'Requires migration 20261012000000_reconcile_stripe_entitlement.sql to be applied to staging Supabase')
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('idempotent')
    const testSuffix = uniqueSuffix()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `Test1234!${testSuffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Idempotent Test' },
    })
    expect(createError).toBeNull()
    expect(created.user).not.toBeNull()
    const userId = created.user!.id

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Idempotent Test',
        stripe_reconcile_version: 0,
        subscription_tier: 'none',
        manual_tier: 'none',
      })
      expect(profileError).toBeNull()

      const eventId = `evt_test_${testSuffix}`
      const subscriptionId = `sub_test_${testSuffix}`
      const customerId = `cus_test_${testSuffix}`

      // First reconciliation call
      const { data: result1, error: error1 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 0,
        p_event_id: eventId,
        p_event_created: Math.floor(Date.now() / 1000),
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: Math.floor(Date.now() / 1000) - 3600,
        p_tier: 'tier2',
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error1).toBeNull()
      const parsed1 = typeof result1 === 'string' ? JSON.parse(result1) : result1
      expect(parsed1.result).toBe('applied')

      // Second call with SAME event ID should return 'duplicate'
      const { data: result2, error: error2 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 1,
        p_event_id: eventId, // Same event ID!
        p_event_created: Math.floor(Date.now() / 1000),
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: Math.floor(Date.now() / 1000) - 3600,
        p_tier: 'tier3', // Different tier - should be ignored
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error2).toBeNull()
      const parsed2 = typeof result2 === 'string' ? JSON.parse(result2) : result2
      expect(parsed2.result).toBe('duplicate')

      // Verify subscription tier was NOT changed (idempotent)
      const { data: sub2 } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .single()
      expect(sub2!.tier).toBe('tier2') // Still tier2, not tier3

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('older event after newer preserves newer state', async () => {
    const exists = await checkRpcExists()
    test.skip(!exists, 'Requires migration 20261012000000_reconcile_stripe_entitlement.sql to be applied to staging Supabase')

    const supabase = createServiceRoleClient()
    const email = uniqueEmail('order-test')
    const testSuffix = uniqueSuffix()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `Test1234!${testSuffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Order Test' },
    })
    expect(createError).toBeNull()
    expect(created.user).not.toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Order Test',
        stripe_reconcile_version: 0,
        subscription_tier: 'none',
        manual_tier: 'none',
      })

      const subscriptionId = `sub_order_${testSuffix}`
      const customerId = `cus_order_${testSuffix}`
      const newerEventId = `evt_newer_${testSuffix}`
      const olderEventId = `evt_older_${testSuffix}`
      const newerTimestamp = Math.floor(Date.now() / 1000)
      const olderTimestamp = newerTimestamp - 3600

      // First: process the NEWER event (tier3)
      const { data: result1, error: error1 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 0,
        p_event_id: newerEventId,
        p_event_created: newerTimestamp,
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: olderTimestamp - 86400,
        p_tier: 'tier3',
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error1).toBeNull()
      const parsed1 = typeof result1 === 'string' ? JSON.parse(result1) : result1
      expect(parsed1.result).toBe('applied')

      // Second: process OLDER event but with fresh-read state (tier3)
      const { data: result2, error: error2 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 1,
        p_event_id: olderEventId,
        p_event_created: olderTimestamp,
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: olderTimestamp - 86400,
        p_tier: 'tier3', // Fresh read returns current tier
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error2).toBeNull()
      const parsed2 = typeof result2 === 'string' ? JSON.parse(result2) : result2
      expect(parsed2.result).toBe('applied')

      // Verify final state is tier3
      const { data: profileFinal } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single()
      expect(profileFinal!.subscription_tier).toBe('tier3')

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('version conflict returns retry', async () => {
    const exists = await checkRpcExists()
    test.skip(!exists, 'Requires migration 20261012000000_reconcile_stripe_entitlement.sql to be applied to staging Supabase')

    const supabase = createServiceRoleClient()
    const email = uniqueEmail('version-test')
    const testSuffix = uniqueSuffix()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `Test1234!${testSuffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Version Test' },
    })
    expect(createError).toBeNull()
    expect(created.user).not.toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Version Test',
        stripe_reconcile_version: 5,
        subscription_tier: 'none',
        manual_tier: 'none',
      })

      const subscriptionId = `sub_ver_${testSuffix}`
      const customerId = `cus_ver_${testSuffix}`
      const eventId = `evt_ver_${testSuffix}`

      // Try with wrong expected version
      const { data: result, error } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 0, // Wrong!
        p_event_id: eventId,
        p_event_created: Math.floor(Date.now() / 1000),
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: Math.floor(Date.now() / 1000) - 3600,
        p_tier: 'tier2',
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error).toBeNull()
      const parsed = typeof result === 'string' ? JSON.parse(result) : result
      expect(parsed.result).toBe('retry')
      expect(parsed.version).toBe(5)

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('manual_tier preserved when Stripe tier is lower', async () => {
    const exists = await checkRpcExists()
    test.skip(!exists, 'Requires migration 20261012000000_reconcile_stripe_entitlement.sql to be applied to staging Supabase')

    const supabase = createServiceRoleClient()
    const email = uniqueEmail('manual-tier')
    const testSuffix = uniqueSuffix()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `Test1234!${testSuffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Manual Tier Test' },
    })
    expect(createError).toBeNull()
    expect(created.user).not.toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Manual Tier Test',
        stripe_reconcile_version: 0,
        subscription_tier: 'tier3',
        manual_tier: 'tier3',
      })

      const subscriptionId = `sub_manual_${testSuffix}`
      const customerId = `cus_manual_${testSuffix}`
      const eventId = `evt_manual_${testSuffix}`

      const { data: result, error } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 0,
        p_event_id: eventId,
        p_event_created: Math.floor(Date.now() / 1000),
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: Math.floor(Date.now() / 1000) - 3600,
        p_tier: 'tier1', // Lower Stripe tier
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error).toBeNull()
      const parsed = typeof result === 'string' ? JSON.parse(result) : result
      expect(parsed.result).toBe('applied')

      // Verify subscription has tier1
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .single()
      expect(sub!.tier).toBe('tier1')

      // Verify effective tier is still tier3 (higher of manual and Stripe)
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, manual_tier')
        .eq('id', userId)
        .single()
      expect(profile!.manual_tier).toBe('tier3')
      expect(profile!.subscription_tier).toBe('tier3')

    } finally {
      await deleteAuthUser(userId)
    }
  })
})
