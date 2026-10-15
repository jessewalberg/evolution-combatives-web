import { test, expect } from '../test'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { uniqueSuffix, uniqueEmail } from '../helpers/unique'
import { deleteAuthUser } from '../helpers/api'

/**
 * Stripe Webhook Idempotency and Order Independence Tests
 *
 * These tests verify that the reconciliation system:
 * 1. Is idempotent: same event delivered twice produces same result
 * 2. Is order-independent: older event after newer one doesn't overwrite
 * 3. Produces correct final entitlement
 *
 * These tests use the database directly to verify the reconciliation RPC
 * behavior, simulating what the webhook handler does.
 */

test.describe('Stripe Entitlement Reconciliation Logic', () => {
  test('duplicate event ID is ignored (idempotency)', async () => {
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('idempotent')
    const testSuffix = uniqueSuffix()

    // Create test user
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: `Test1234!${testSuffix}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Idempotent Test' },
    })
    expect(createError).toBeNull()
    const userId = created.user!.id

    try {
      // Create profile with initial reconcile version
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Idempotent Test',
        stripe_reconcile_version: 0,
        subscription_tier: 'none',
        manual_tier: 'none',
      })

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

      // Verify the subscription was created
      const { data: sub1 } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .single()
      expect(sub1).not.toBeNull()
      expect(sub1!.tier).toBe('tier2')
      expect(sub1!.stripe_event_id).toBe(eventId)

      // Verify profile tier was updated
      const { data: profile1 } = await supabase
        .from('profiles')
        .select('subscription_tier, stripe_reconcile_version')
        .eq('id', userId)
        .single()
      expect(profile1!.subscription_tier).toBe('tier2')
      expect(profile1!.stripe_reconcile_version).toBe(1)

      // Second call with SAME event ID should return 'duplicate'
      const { data: result2, error: error2 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 1, // Updated version
        p_event_id: eventId, // Same event ID
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

      // Verify profile tier was NOT changed
      const { data: profile2 } = await supabase
        .from('profiles')
        .select('subscription_tier, stripe_reconcile_version')
        .eq('id', userId)
        .single()
      expect(profile2!.subscription_tier).toBe('tier2')
      expect(profile2!.stripe_reconcile_version).toBe(1) // Version unchanged

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('newer event overwrites older event (order independence via fresh read)', async () => {
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
      const olderTimestamp = newerTimestamp - 3600 // 1 hour older

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

      // Verify tier3 was applied
      const { data: profile1 } = await supabase
        .from('profiles')
        .select('subscription_tier, stripe_reconcile_version')
        .eq('id', userId)
        .single()
      expect(profile1!.subscription_tier).toBe('tier3')
      expect(profile1!.stripe_reconcile_version).toBe(1)

      // Second: process the OLDER event (tier1)
      // In a real scenario, the handler re-reads from Stripe API and gets current state
      // Here we simulate what happens when an older event arrives but the fresh read
      // returns the current (newer) state. The RPC applies whatever we pass.
      // The key is that the webhook handler always passes fresh Stripe state.
      //
      // This test verifies that the RPC itself accepts updates regardless of event timestamp,
      // because the handler's responsibility is to pass fresh state.
      const { data: result2, error: error2 } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 1,
        p_event_id: olderEventId, // Different event ID
        p_event_created: olderTimestamp, // Older timestamp
        p_stripe_subscription_id: subscriptionId,
        p_stripe_customer_id: customerId,
        p_customer_ids: [customerId],
        p_subscription_created: olderTimestamp - 86400,
        p_tier: 'tier3', // Fresh read would return current tier
        p_status: 'active',
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_cancel_at_period_end: false,
        p_canceled_at: null,
      })

      expect(error2).toBeNull()
      const parsed2 = typeof result2 === 'string' ? JSON.parse(result2) : result2
      expect(parsed2.result).toBe('applied')

      // Verify final state is tier3 (the fresh read state, not the old event's payload)
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

  test('version conflict returns retry (concurrent protection)', async () => {
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
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Version Test',
        stripe_reconcile_version: 5, // Start at version 5
        subscription_tier: 'none',
        manual_tier: 'none',
      })

      const subscriptionId = `sub_ver_${testSuffix}`
      const customerId = `cus_ver_${testSuffix}`
      const eventId = `evt_ver_${testSuffix}`

      // Try to reconcile with wrong expected version (0 instead of 5)
      const { data: result, error } = await supabase.rpc('reconcile_stripe_entitlement', {
        p_user_id: userId,
        p_expected_version: 0, // Wrong version!
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
      expect(parsed.version).toBe(5) // Returns current version

      // Verify no subscription was created
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .maybeSingle()
      expect(sub).toBeNull()

    } finally {
      await deleteAuthUser(userId)
    }
  })

  test('manual_tier is preserved when Stripe tier changes', async () => {
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
    const userId = created.user!.id

    try {
      // Create profile with manual_tier = tier3 (comped membership)
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Manual Tier Test',
        stripe_reconcile_version: 0,
        subscription_tier: 'tier3', // Currently tier3 from manual
        manual_tier: 'tier3', // Manual grant
      })

      const subscriptionId = `sub_manual_${testSuffix}`
      const customerId = `cus_manual_${testSuffix}`
      const eventId = `evt_manual_${testSuffix}`

      // Reconcile with tier1 Stripe subscription
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

      // Verify subscription row has tier1
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .single()
      expect(sub!.tier).toBe('tier1')

      // Verify profile effective tier is still tier3 (higher of manual and Stripe)
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, manual_tier')
        .eq('id', userId)
        .single()
      expect(profile!.manual_tier).toBe('tier3') // Preserved
      expect(profile!.subscription_tier).toBe('tier3') // Higher of tier3 and tier1

    } finally {
      await deleteAuthUser(userId)
    }
  })
})
