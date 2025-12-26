/**
 * Evolution Combatives - Shared Database Service
 * Common database operations for both React Native and Next.js platforms
 * 
 * @description Centralized database service using Supabase client
 * @author Evolution Combatives
 */

import type {
    TypedSupabaseClient,
    VideoFilters,
    VideoWithRelations,
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
    NotificationData,
} from '../types/services'
import { handleSupabaseError, withRetry, safeQuery } from '../utils/supabase-errors'

/**
 * Database service class that provides common database operations
 * Works with any Supabase client (browser, server, admin, mobile)
 */
export class DatabaseService {
    constructor(private supabase: TypedSupabaseClient) { }

    // ==========================================
    // VIDEO OPERATIONS
    // ==========================================

    /**
     * Get videos with optional filtering and pagination
     */
    async getVideos(filters?: VideoFilters): Promise<ServiceResponse<VideoWithRelations[]>> {
        try {
            const result = await withRetry(async () => {
                let query = this.supabase
                    .from('videos')
                    .select(`
             *,
             category:categories(
               id,
               name,
               discipline:disciplines(
                 id,
                 name
               )
             ),
             instructor:profiles!videos_instructor_id_fkey(
               id,
               full_name,
               bio,
               avatar_url
             ),
             tags:video_tags(
               tag:tags(
                 id,
                 name
               )
             )
           `)

                // Apply filters
                if (filters?.categoryId) {
                    query = query.eq('category_id', filters.categoryId)
                }
                if (filters?.difficulty) {
                    query = query.eq('difficulty', filters.difficulty)
                }
                if (filters?.subscriptionTier) {
                    query = query.lte('subscription_tier_level', this.getSubscriptionTierLevel(filters.subscriptionTier))
                }
                if (filters?.instructorId) {
                    query = query.eq('instructor_id', filters.instructorId)
                }
                if (filters?.status) {
                    query = query.eq('status', filters.status)
                } else {
                    // Default to published videos only
                    query = query.eq('status', 'published')
                }
                if (filters?.search) {
                    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
                }

                // Apply sorting
                const sortBy = filters?.sortBy || 'created_at'
                const sortOrder = filters?.sortOrder || 'desc'
                query = query.order(sortBy, { ascending: sortOrder === 'asc' })

                // Apply pagination
                if (filters?.limit) {
                    query = query.limit(filters.limit)
                }
                if (filters?.offset) {
                    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
                }

                const { data, error } = await query

                if (error) throw error

                // Transform the data to match our interface
                const transformedData = data?.map(video => ({
                    ...video,
                    tags: video.tags?.map((t: { tag: { id: string; name: string } }) => t.tag).filter(Boolean) || []
                })) || []

                return transformedData
            }, 3, 1000, 'getVideos')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'getVideos')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Get a single video by ID
     */
    async getVideo(videoId: string): Promise<ServiceResponse<VideoWithRelations>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('videos')
                .select(`
          *,
          category:categories(
            id,
            name,
            discipline:disciplines(
              id,
              name
            )
          ),
          instructor:profiles!videos_instructor_id_fkey(
            id,
            full_name,
            bio,
            avatar_url
          ),
          tags:video_tags(
            tag:tags(
              id,
              name
            )
          )
        `)
                .eq('id', videoId)
                .eq('status', 'published')
                .single()

            if (error) throw error

            // Transform the data
            const transformedData = data ? {
                ...data,
                tags: data.tags?.map((t: { tag: { id: string; name: string } }) => t.tag).filter(Boolean) || []
            } : null

            return { data: transformedData, error }
        })
    }

    /**
     * Get video analytics (admin only)
     */
    async getVideoAnalytics(): Promise<ServiceResponse<VideoAnalytics>> {
        return safeQuery(async () => {
            // This would typically be a database function or complex query
            const { data, error } = await this.supabase.rpc('get_video_analytics')
            return { data, error }
        })
    }

    // ==========================================
    // USER OPERATIONS
    // ==========================================

    /**
     * Get user profile by ID
     */
    async getUserProfile(userId: string): Promise<ServiceResponse<UserProfileWithSubscription>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('profiles')
                .select(`
          *,
          subscription:subscriptions(
            id,
            tier,
            status,
            platform,
            external_subscription_id,
            current_period_end,
            created_at
          )
        `)
                .eq('id', userId)
                .single()

            if (error) throw error

            // Transform subscription data
            const transformedData = data ? {
                ...data,
                subscription: data.subscription?.[0] || null
            } : null

            return { data: transformedData, error }
        })
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, updates: ProfileUpdateData): Promise<ServiceResponse<UserProfileWithSubscription>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase
                    .from('profiles')
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId)
                    .select()
                    .single()

                if (error) throw error

                return data
            }, 2, 1000, 'updateProfile')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updateProfile')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Get user progress
     */
    async getUserProgress(userId: string, videoId?: string): Promise<ServiceResponse<UserProgressWithVideo[]>> {
        return safeQuery(async () => {
            let query = this.supabase
                .from('user_progress')
                .select(`
          *,
          video:videos(
            id,
            title,
            thumbnail_url,
            duration,
            category:categories(
              name,
              discipline:disciplines(name)
            )
          )
        `)
                .eq('user_id', userId)

            if (videoId) {
                query = query.eq('video_id', videoId)
            }

            query = query.order('last_watched_at', { ascending: false })

            const { data, error } = await query
            return { data, error }
        })
    }

    /**
     * Update user progress
     */
    async updateProgress(
        userId: string,
        videoId: string,
        progressData: ProgressUpdateData
    ): Promise<ServiceResponse<UserProgressWithVideo>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase
                    .from('user_progress')
                    .upsert({
                        user_id: userId,
                        video_id: videoId,
                        ...progressData,
                        last_watched_at: progressData.last_watched_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select(`
             *,
             video:videos(
               id,
               title,
               thumbnail_url,
               duration,
               category:categories(
                 name,
                 discipline:disciplines(name)
               )
             )
           `)
                    .single()

                if (error) throw error

                return data
            }, 2, 1000, 'updateProgress')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updateProgress')
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // CONTENT OPERATIONS
    // ==========================================

    /**
     * Get categories with video counts
     */
    async getCategories(disciplineId?: string): Promise<ServiceResponse<CategoryWithCount[]>> {
        return safeQuery(async () => {
            let query = this.supabase
                .from('categories')
                .select(`
          *,
          discipline:disciplines(
            id,
            name
          ),
          videos(count)
        `)

            if (disciplineId) {
                query = query.eq('discipline_id', disciplineId)
            }

            query = query.order('sort_order', { ascending: true })

            const { data, error } = await query

            if (error) throw error

            // Transform data to include video count
            const transformedData = data?.map(category => ({
                ...category,
                video_count: category.videos?.[0]?.count || 0
            })) || []

            return { data: transformedData, error }
        })
    }

    /**
 * Get disciplines
 */
    async getDisciplines(): Promise<ServiceResponse<Array<{
        id: string
        name: string
        description?: string
        sort_order: number
        created_at: string
    }>>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('disciplines')
                .select('*')
                .order('sort_order', { ascending: true })

            return { data, error }
        })
    }

    /**
     * Get instructors with stats
     */
    async getInstructors(): Promise<ServiceResponse<InstructorWithStats[]>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('profiles')
                .select(`
          *,
          videos(count),
          video_views:videos(views)
        `)
                .not('instructor_bio', 'is', null) // Only get profiles that are instructors

            if (error) throw error

            // Transform data to include stats
            const transformedData = data?.map(instructor => ({
                ...instructor,
                video_count: instructor.videos?.[0]?.count || 0,
                total_views: instructor.video_views?.reduce((sum: number, v: { views: number }) => sum + (v.views || 0), 0) || 0
            })) || []

            return { data: transformedData, error }
        })
    }

    // ==========================================
    // SUBSCRIPTION OPERATIONS
    // ==========================================

    /**
     * Get user subscription
     */
    async getUserSubscription(userId: string): Promise<ServiceResponse<{
        id: string
        user_id: string
        tier: string
        status: string
        platform: 'revenuecat' | 'stripe'
        external_subscription_id: string
        current_period_end: string | null
        created_at: string
    } | null>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single()

            return { data, error }
        })
    }

    /**
     * Update subscription (admin only)
     */
    async updateSubscription(
        userId: string,
        subscriptionData: SubscriptionUpdateData
    ): Promise<ServiceResponse<{
        id: string
        user_id: string
        tier: string
        status: string
        platform: 'revenuecat' | 'stripe'
        external_subscription_id: string
        current_period_end: string | null
        created_at: string
    }>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase
                    .from('subscriptions')
                    .update({
                        ...subscriptionData,
                    })
                    .eq('user_id', userId)
                    .select()
                    .single()

                if (error) throw error

                return data
            }, 2, 1000, 'updateSubscription')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updateSubscription')
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // ADMIN OPERATIONS
    // ==========================================

    /**
     * Get all users with pagination (admin only)
     */
    async getAllUsers(options: PaginationOptions): Promise<ServiceResponse<PaginatedResponse<UserProfileWithSubscription>>> {
        return safeQuery(async () => {
            const { page, pageSize, orderBy = 'created_at', orderDirection = 'desc' } = options
            const offset = (page - 1) * pageSize

            // Get total count
            const { count } = await this.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })

            // Get paginated data
            const { data, error } = await this.supabase
                .from('profiles')
                .select(`
          *,
          subscription:subscriptions(
            id,
            tier,
            status,
            platform,
            external_subscription_id,
            current_period_end,
            created_at
          )
        `)
                .order(orderBy, { ascending: orderDirection === 'asc' })
                .range(offset, offset + pageSize - 1)

            if (error) throw error

            const totalPages = Math.ceil((count || 0) / pageSize)

            const result: PaginatedResponse<UserProfileWithSubscription> = {
                data: data?.map(user => ({
                    ...user,
                    subscription: user.subscription?.[0] || null
                })) || [],
                count: count || 0,
                page,
                pageSize,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }

            return { data: result, error }
        })
    }

    /**
     * Get user analytics (admin only)
     */
    async getUserAnalytics(): Promise<ServiceResponse<UserAnalytics>> {
        return safeQuery(async () => {
            // This would typically be a database function
            const { data, error } = await this.supabase.rpc('get_user_analytics')
            return { data, error }
        })
    }

    // ==========================================
    // SEARCH OPERATIONS
    // ==========================================

    /**
     * Search across videos, categories, and instructors
     */
    async search(query: string, limit = 20): Promise<ServiceResponse<SearchResult[]>> {
        return safeQuery(async () => {
            // This would typically use a full-text search function
            const { data, error } = await this.supabase.rpc('search_content', {
                search_query: query,
                result_limit: limit
            })

            return { data, error }
        })
    }

    // ==========================================
    // NOTIFICATION OPERATIONS
    // ==========================================

    /**
     * Get user notifications
     */
    async getUserNotifications(userId: string): Promise<ServiceResponse<NotificationData[]>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)

            return { data, error }
        })
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId: string): Promise<ServiceResponse<NotificationData>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', notificationId)
                    .select()
                    .single()

                if (error) throw error

                return data
            }, 2, 1000, 'markNotificationRead')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'markNotificationRead')
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Convert subscription tier to numeric level for filtering
     */
    private getSubscriptionTierLevel(tier: string): number {
        switch (tier) {
            case 'none': return 0
            case 'tier1': return 1
            case 'tier2': return 2
            case 'tier3': return 3
            default: return 0
        }
    }

    /**
     * Execute raw SQL query (admin only)
     */
    async executeRawQuery<T = unknown>(query: string, params?: unknown[]): Promise<ServiceResponse<T>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase.rpc('execute_sql', {
                query,
                params: params || []
            })

            return { data, error }
        })
    }

    /**
     * Get table statistics (admin only)
     */
    async getTableStats(): Promise<ServiceResponse<Record<string, number>>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase.rpc('get_table_stats')
            return { data, error }
        })
    }
} 