/**
 * Evolution Combatives - Shared Library Index
 * Barrel exports for all shared functionality
 */

// Re-export database types directly (avoiding conflicts from services barrel)
export * from './types/database'
export * from './types/services'

// Re-export services  
export { AuthService, DatabaseService, RealtimeService } from './services'

// Re-export config
export * from './config/supabase'

// Re-export constants (excluding conflicting SubscriptionTier)
export { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_HIERARCHY, SUBSCRIPTION_PRICING, SUBSCRIPTION_FEATURES } from './constants/subscriptionTiers'

// Re-export utilities
export * from './utils/supabase-errors'