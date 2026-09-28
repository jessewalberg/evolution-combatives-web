import type { SubscriptionTier } from '@/src/lib/shared/constants/subscriptionTiers'

export function getStripePriceId(tier: SubscriptionTier): string {
    switch (tier) {
        case 'tier1': return process.env.STRIPE_BEGINNER_PRICE_ID || ''
        case 'tier2': return process.env.STRIPE_INTERMEDIATE_PRICE_ID || ''
        case 'tier3': return process.env.STRIPE_ADVANCED_PRICE_ID || ''
        case 'none': return ''
    }
}
