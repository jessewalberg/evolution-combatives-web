/**
 * Evolution Combatives - Shared Services
 * Barrel exports for all shared Supabase services
 * 
 * @description Centralized exports for database, auth, and realtime services
 * @author Evolution Combatives
 */

// Service classes
export { DatabaseService } from './database'
export { AuthService } from './auth'
export { RealtimeService } from './realtime'

// Re-export types from services (avoiding conflicts with database types)
export type {
    TypedSupabaseClient,
    VideoFilters,
    UserProfileWithSubscription,
    UserProgressWithVideo,
    ProgressUpdateData,
    ProfileUpdateData,
    CategoryWithCount,
    InstructorWithStats,
    PaginationOptions,
    PaginatedResponse,
    ServiceResponse,
    SubscriptionUpdateData,
    VideoAnalytics,
    UserAnalytics,
    SearchResult,
    QuestionFilters,
    AnswerTemplate,
    ContentUploadData,
    BulkOperationResult,
    NotificationData,
    UserRegistrationData,
    RealtimeCallback,
    AuthStateCallback,
} from '../types/services'

// Re-export error handling utilities
export {
    handleSupabaseError,
    withRetry,
    safeQuery,
    EvolutionCombativesError,
    isAuthError,
    isPostgrestError,
    isNetworkError,
    formatErrorMessage,
    ErrorCodes,
} from '../utils/supabase-errors'

// Re-export configuration
export {
    supabaseConfig,
    validateSupabaseConfig,
    platformConfigs,
    environmentConfig,
} from '../config/supabase' 