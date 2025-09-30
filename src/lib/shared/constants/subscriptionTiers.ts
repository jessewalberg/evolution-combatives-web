/**
 * Evolution Combatives - Subscription Tiers Constants
 * Business logic for subscription tiers, pricing, and features
 * 
 * @description Clean tier system: Tier 1 ($9), Tier 2 ($19), Tier 3 ($49)
 * @author Evolution Combatives
 */

// Define the subscription tier type locally to avoid circular dependency
export type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3';

export const SUBSCRIPTION_TIERS = {
    NONE: 'none' as const,
    TIER1: 'tier1' as const,
    TIER2: 'tier2' as const,
    TIER3: 'tier3' as const,
} satisfies Record<string, SubscriptionTier>;

export const SUBSCRIPTION_TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    none: 0,
    tier1: 1,
    tier2: 2,
    tier3: 3,
};

export const SUBSCRIPTION_PRICING = {
    [SUBSCRIPTION_TIERS.NONE]: {
        monthly: 0,
        currency: 'USD',
        stripePriceId: '', // Free tier has no Stripe price ID
    },
    [SUBSCRIPTION_TIERS.TIER1]: {
        monthly: 19,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_BEGINNER_PRICE_ID || '',
    },
    [SUBSCRIPTION_TIERS.TIER2]: {
        monthly: 29,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_INTERMEDIATE_PRICE_ID || '',
    },
    [SUBSCRIPTION_TIERS.TIER3]: {
        monthly: 39,
        currency: 'USD',
        stripePriceId: process.env.STRIPE_ADVANCED_PRICE_ID || '',
    },
} as const;

export const SUBSCRIPTION_FEATURES = {
    [SUBSCRIPTION_TIERS.NONE]: [
        'Limited free content',
        'Basic app access',
        'Community access (read-only)',
    ],
    [SUBSCRIPTION_TIERS.TIER1]: [
        'All free features',
        'Basic martial arts content',
        'Jiu Jitsu fundamentals',
        'Wrestling basics',
        'Full mobile app access',
        'Progress tracking',
        'Community participation',
    ],
    [SUBSCRIPTION_TIERS.TIER2]: [
        'All Tier 1 features',
        'Advanced techniques',
        'Striking fundamentals',
        'Instructor Q&A access',
        'Priority support',
        'Detailed analytics',
        'Offline viewing',
    ],
    [SUBSCRIPTION_TIERS.TIER3]: [
        'All Tier 2 features',
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
    [SUBSCRIPTION_TIERS.NONE]: {
        disciplines: ['law_enforcement'], // Law enforcement basic content should be accessible to free users
        categories: ['free_content', 'basic_defensive_tactics'],
        features: ['basic_access'],
    },
    [SUBSCRIPTION_TIERS.TIER1]: {
        disciplines: ['jiujitsu', 'wrestling'],
        categories: ['fundamentals', 'basic_techniques'],
        features: ['progress_tracking', 'mobile_access'],
    },
    [SUBSCRIPTION_TIERS.TIER2]: {
        disciplines: ['jiujitsu', 'wrestling', 'striking'],
        categories: ['fundamentals', 'basic_techniques', 'advanced_techniques', 'combinations'],
        features: ['progress_tracking', 'mobile_access', 'instructor_qa', 'offline_viewing'],
    },
    [SUBSCRIPTION_TIERS.TIER3]: {
        disciplines: ['jiujitsu', 'wrestling', 'striking', 'law_enforcement', 'defensive'],
        categories: ['fundamentals', 'basic_techniques', 'advanced_techniques', 'combinations', 'tactical', 'defensive_tactics'],
        features: ['progress_tracking', 'mobile_access', 'instructor_qa', 'offline_viewing', 'direct_instructor_access', 'exclusive_content'],
    },
} as const;

// Tier upgrade paths
export const TIER_UPGRADE_PATHS = {
    [SUBSCRIPTION_TIERS.NONE]: [SUBSCRIPTION_TIERS.TIER1, SUBSCRIPTION_TIERS.TIER2, SUBSCRIPTION_TIERS.TIER3],
    [SUBSCRIPTION_TIERS.TIER1]: [SUBSCRIPTION_TIERS.TIER2, SUBSCRIPTION_TIERS.TIER3],
    [SUBSCRIPTION_TIERS.TIER2]: [SUBSCRIPTION_TIERS.TIER3],
    [SUBSCRIPTION_TIERS.TIER3]: [], // No upgrades from highest tier
} as const;

/**
 * Check if a user has access to a specific discipline based on their subscription tier
 */
export function hasAccessToDiscipline(
    userTier: SubscriptionTier, 
    disciplineRequiredTier: SubscriptionTier
): boolean {
    // If discipline requires 'none', it's free for everyone
    if (disciplineRequiredTier === 'none') {
        return true;
    }
    
    // Check if user tier meets or exceeds required tier
    const userTierLevel = SUBSCRIPTION_TIER_HIERARCHY[userTier];
    const requiredTierLevel = SUBSCRIPTION_TIER_HIERARCHY[disciplineRequiredTier];
    
    return userTierLevel >= requiredTierLevel;
}

/**
 * Check if a user has access to a specific content area based on business rules
 */
export function hasAccessToContent(
    userTier: SubscriptionTier,
    contentType: 'discipline' | 'category',
    contentSlug: string
): boolean {
    const accessMapping = CONTENT_ACCESS_BY_TIER[userTier];

    if (contentType === 'discipline') {
        return (accessMapping.disciplines as readonly string[]).includes(contentSlug);
    }

    return (accessMapping.categories as readonly string[]).includes(contentSlug);
}

// Display information for UI
export const TIER_DISPLAY_INFO = {
    [SUBSCRIPTION_TIERS.NONE]: {
        name: 'Free',
        description: 'Basic access to limited content',
        color: 'gray', // Gray
        popular: false,
    },
    [SUBSCRIPTION_TIERS.TIER1]: {
        name: 'Tier 1',
        description: 'Perfect for martial arts beginners',
        color: 'success', // Green
        popular: false,
    },
    [SUBSCRIPTION_TIERS.TIER2]: {
        name: 'Tier 2',
        description: 'Advanced training for serious practitioners',
        color: 'primary', // Blue
        popular: true,
    },
    [SUBSCRIPTION_TIERS.TIER3]: {
        name: 'Tier 3',
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