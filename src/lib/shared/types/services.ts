/**
 * Evolution Combatives - Shared Service Types
 * Common types and interfaces for Supabase services
 * 
 * @description Type definitions for database operations, filters, and service interfaces
 * @author Evolution Combatives
 */

import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { Database, SubscriptionTier, AdminRole, VideoDifficulty, VideoWithRelations } from './database'

/**
 * Supabase client type with database schema
 */
export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Video filtering options
 */
export interface VideoFilters {
    categoryId?: string
    disciplineId?: string
    difficulty?: VideoDifficulty
    subscriptionTier?: SubscriptionTier
    instructorId?: string
    limit?: number
    offset?: number
    search?: string
    status?: 'draft' | 'published' | 'archived'
    sortBy?: 'created_at' | 'title' | 'duration' | 'views'
    sortOrder?: 'asc' | 'desc'
}

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
    page: number
    pageSize: number
    orderBy?: string
    orderDirection?: 'asc' | 'desc'
}

/**
 * User data for registration
 */
export interface UserRegistrationData {
    full_name?: string
    badge_number?: string
    department?: string
    rank?: string
    phone?: string
    avatar_url?: string
}

/**
 * Profile update data
 */
export interface ProfileUpdateData {
    full_name?: string
    badge_number?: string
    department?: string
    rank?: string
    phone?: string
    avatar_url?: string
    bio?: string
    notification_preferences?: Record<string, boolean>
}

/**
 * Progress update data
 */
export interface ProgressUpdateData {
    progress_seconds: number
    progress_percentage: number
    completed?: boolean
    last_watched_at?: string
}

/**
 * Subscription data for admin operations
 */
export interface SubscriptionUpdateData {
    tier?: SubscriptionTier
    status?: 'active' | 'inactive' | 'canceled' | 'past_due'
    current_period_end?: string
    external_subscription_id?: string
}

// Types imported from database.ts to avoid conflicts

/**
 * Database record base interface
 */
export interface DatabaseRecord {
    id?: string
    created_at?: string
    updated_at?: string
    [key: string]: unknown
}

/**
 * User presence state for realtime tracking
 */
export interface UserPresenceState {
    user_id: string
    online_at: string
    status?: 'online' | 'away' | 'busy'
    [key: string]: unknown
}

/**
 * Broadcast message payload
 */
export interface BroadcastPayload {
    event: string
    type: string
    [key: string]: unknown
}

/**
 * Real-time callback function
 */
export type RealtimeCallback = (payload: {
    new?: DatabaseRecord
    old?: DatabaseRecord
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}) => void

/**
 * Authentication state change callback
 */
export type AuthStateCallback = (event: string, session: Session | null) => void

/**
 * Service response type
 */
export interface ServiceResponse<T> {
    data: T | null
    error: string | null
}

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
    data: T[]
    count: number
    page: number
    pageSize: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
}

// VideoWithRelations imported from database.ts
export type { VideoWithRelations }

/**
 * User profile with subscription
 */
export interface UserProfileWithSubscription {
    id: string
    full_name: string
    email: string
    badge_number?: string
    department?: string
    rank?: string
    phone?: string
    avatar_url?: string
    bio?: string
    admin_role: AdminRole
    created_at: string
    updated_at: string
    last_sign_in_at?: string
    subscription?: {
        id: string
        tier: string
        status: string
        platform: 'revenuecat' | 'stripe'
        external_subscription_id: string
        current_period_end: string | null
        created_at: string
    }
}

/**
 * User progress with video details
 */
export interface UserProgressWithVideo {
    id: string
    user_id: string
    video_id: string
    progress_seconds: number
    progress_percentage: number
    completed: boolean
    last_watched_at: string
    created_at: string
    updated_at: string
    video: {
        id: string
        title: string
        thumbnail_url?: string
        duration: number
        category: {
            name: string
            discipline: {
                name: string
            }
        }
    }
}

/**
 * Category with video count
 */
export interface CategoryWithCount {
    id: string
    name: string
    description?: string
    thumbnail_url?: string
    sort_order: number
    discipline_id: string
    created_at: string
    discipline: {
        id: string
        name: string
    }
    video_count: number
}

/**
 * Instructor with stats
 */
export interface InstructorWithStats {
    id: string
    full_name: string
    bio?: string
    avatar_url?: string
    specialties?: string[]
    years_experience?: number
    certifications?: string[]
    created_at: string
    video_count: number
    total_views: number
}

/**
 * Analytics data types
 */
export interface VideoAnalytics {
    total_videos: number
    total_views: number
    total_watch_time: number
    average_completion_rate: number
    popular_categories: Array<{
        category: string
        views: number
    }>
    popular_videos: Array<{
        id: string
        title: string
        views: number
        completion_rate: number
    }>
}

export interface UserAnalytics {
    total_users: number
    active_users: number
    new_users_this_month: number
    subscription_breakdown: Array<{
        tier: SubscriptionTier | 'none'
        count: number
        percentage: number
    }>
    engagement_metrics: {
        average_session_duration: number
        videos_per_user: number
        completion_rate: number
    }
}

/**
 * Search result types
 */
export interface SearchResult {
    type: 'video' | 'category' | 'instructor'
    id: string
    title: string
    description?: string
    thumbnail_url?: string
    relevance_score: number
    metadata?: Record<string, unknown>
}

/**
 * Notification data
 */
export interface NotificationData {
    id: string
    user_id: string
    type: 'video_added' | 'subscription_expiring' | 'new_feature' | 'system_update'
    title: string
    message: string
    data?: Record<string, unknown>
    read: boolean
    created_at: string
}

/**
 * Q&A related types
 */
export interface QuestionFilters {
    status?: 'pending' | 'answered' | 'closed'
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    category?: string
    userId?: string
    adminId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
}

export interface AnswerTemplate {
    id: string
    title: string
    content: string
    category: string
    usage_count: number
    created_at: string
    updated_at: string
}

/**
 * Content management types
 */
export interface ContentUploadData {
    title: string
    description?: string
    category_id: string
    instructor_id: string
    difficulty: VideoDifficulty
    subscription_tier: SubscriptionTier
    tags?: string[]
    thumbnail_file?: File | Blob
    video_file?: File | Blob
}

export interface BulkOperationResult {
    success_count: number
    error_count: number
    errors: Array<{
        id: string
        error: string
    }>
} 