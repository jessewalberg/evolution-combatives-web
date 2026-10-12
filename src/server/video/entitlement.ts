import type { createAdminClient } from '@/src/lib/supabase'
import {
    SUBSCRIPTION_TIER_HIERARCHY,
    type SubscriptionTier,
} from '@/src/lib/shared/constants/subscriptionTiers'

function higherTier(current: SubscriptionTier, candidate: unknown): SubscriptionTier {
    if (typeof candidate !== 'string' || !(candidate in SUBSCRIPTION_TIER_HIERARCHY)) return current
    const tier = candidate as SubscriptionTier
    return SUBSCRIPTION_TIER_HIERARCHY[tier] > SUBSCRIPTION_TIER_HIERARCHY[current] ? tier : current
}

export async function getEffectiveTier(adminClient: ReturnType<typeof createAdminClient>, userId: string): Promise<SubscriptionTier> {
    const { data: subscriptionRows, error: subscriptionError } = await adminClient
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .eq('platform', 'stripe')
        .in('status', ['active', 'trialing'])
    if (subscriptionError) throw subscriptionError

    const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('manual_tier')
        .eq('id', userId)
        .maybeSingle()
    if (profileError) throw profileError

    let tier: SubscriptionTier = higherTier('none', profile?.manual_tier)
    for (const row of subscriptionRows ?? []) tier = higherTier(tier, row.tier)
    return tier
}
