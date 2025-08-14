/**
 * Evolution Combatives - Subscription Tiers Constants
 * Business logic for subscription tiers, pricing, and features
 * 
 * @description Aligned with training progression and difficulty: beginner ($9), intermediate ($19), advanced ($49)
 * @author Evolution Combatives
 */

// Define the subscription tier type locally to avoid circular dependency
export type SubscriptionTier = 'beginner' | 'intermediate' | 'advanced';

export const SUBSCRIPTION_TIERS = {
    BEGINNER: 'beginner' as const,
    INTERMEDIATE: 'intermediate' as const,
    ADVANCED: 'advanced' as const,
} satisfies Record<string, SubscriptionTier>;

export const SUBSCRIPTION_TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
};

export const SUBSCRIPTION_PRICING = {
    [SUBSCRIPTION_TIERS.BEGINNER]: {
        monthly: 9,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_BEGINNER_PRICE_ID || '',
    },
    [SUBSCRIPTION_TIERS.INTERMEDIATE]: {
        monthly: 19,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_INTERMEDIATE_PRICE_ID || '',
    },
    [SUBSCRIPTION_TIERS.ADVANCED]: {
        monthly: 49,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_ADVANCED_PRICE_ID || '',
    },
} as const;

export const SUBSCRIPTION_FEATURES = {
    [SUBSCRIPTION_TIERS.BEGINNER]: [
        'Basic martial arts content',
        'Jiu Jitsu fundamentals',
        'Wrestling basics',
        'Mobile app access',
        'Progress tracking',
        'Community access',
    ],
    [SUBSCRIPTION_TIERS.INTERMEDIATE]: [
        'All Beginner features',
        'Advanced techniques',
        'Striking fundamentals',
        'Instructor Q&A access',
        'Priority support',
        'Detailed analytics',
        'Offline viewing',
    ],
    [SUBSCRIPTION_TIERS.ADVANCED]: [
        'All Intermediate features',
        'Law enforcement tactics',
        'Defensive strategies',
        'Exclusive content',
        'Direct instructor access',
        'Advanced analytics',
        'Priority customer support',
        'Early access to new content',
    ],
} as const;

// Content access mapping
export const CONTENT_ACCESS_BY_TIER = {
    [SUBSCRIPTION_TIERS.BEGINNER]: {
        disciplines: ['jiujitsu', 'wrestling'],
        categories: ['fundamentals', 'basic_techniques'],
        features: ['progress_tracking', 'mobile_access'],
    },
    [SUBSCRIPTION_TIERS.INTERMEDIATE]: {
        disciplines: ['jiujitsu', 'wrestling', 'striking'],
        categories: ['fundamentals', 'basic_techniques', 'advanced_techniques', 'combinations'],
        features: ['progress_tracking', 'mobile_access', 'instructor_qa', 'offline_viewing'],
    },
    [SUBSCRIPTION_TIERS.ADVANCED]: {
        disciplines: ['jiujitsu', 'wrestling', 'striking', 'law_enforcement', 'defensive'],
        categories: ['fundamentals', 'basic_techniques', 'advanced_techniques', 'combinations', 'tactical', 'defensive_tactics'],
        features: ['progress_tracking', 'mobile_access', 'instructor_qa', 'offline_viewing', 'direct_instructor_access', 'exclusive_content'],
    },
} as const;

// Tier upgrade paths
export const TIER_UPGRADE_PATHS = {
    [SUBSCRIPTION_TIERS.BEGINNER]: [SUBSCRIPTION_TIERS.INTERMEDIATE, SUBSCRIPTION_TIERS.ADVANCED],
    [SUBSCRIPTION_TIERS.INTERMEDIATE]: [SUBSCRIPTION_TIERS.ADVANCED],
    [SUBSCRIPTION_TIERS.ADVANCED]: [], // No upgrades from highest tier
} as const;

// Display information for UI
export const TIER_DISPLAY_INFO = {
    [SUBSCRIPTION_TIERS.BEGINNER]: {
        name: 'Beginner',
        description: 'Perfect for martial arts beginners',
        color: 'success', // Green
        popular: false,
    },
    [SUBSCRIPTION_TIERS.INTERMEDIATE]: {
        name: 'Intermediate',
        description: 'Advanced training for serious practitioners',
        color: 'primary', // Blue
        popular: true,
    },
    [SUBSCRIPTION_TIERS.ADVANCED]: {
        name: 'Advanced',
        description: 'Elite training for law enforcement professionals',
        color: 'gold', // Gold
        popular: false,
    },
} as const;

// Helper functions
export const getTierLevel = (tier: SubscriptionTier): number => {
    return SUBSCRIPTION_TIER_HIERARCHY[tier];
};

export const canAccessTier = (userTier: SubscriptionTier | null, requiredTier: SubscriptionTier): boolean => {
    if (!userTier) return false;
    return getTierLevel(userTier) >= getTierLevel(requiredTier);
};

export const getUpgradePath = (currentTier: SubscriptionTier): readonly SubscriptionTier[] => {
    return TIER_UPGRADE_PATHS[currentTier];
};

export const getTierPrice = (tier: SubscriptionTier): number => {
    return SUBSCRIPTION_PRICING[tier].monthly;
};

export const getTierFeatures = (tier: SubscriptionTier): readonly string[] => {
    return SUBSCRIPTION_FEATURES[tier];
}; 