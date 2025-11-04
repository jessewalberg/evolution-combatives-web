/**
 * Evolution Combatives - Content Management Service
 * Comprehensive content management with TanStack Query integration
 * 
 * @description Service for managing disciplines, categories, and videos in admin dashboard
 * @author Evolution Combatives
 */

import {
    createAdminClient
} from '../lib/supabase'
import { createClientComponentClient } from '../lib/supabase-browser'
import { handleSupabaseError } from '../lib/shared/utils/supabase-errors'
import { RealtimeService } from '../lib/shared/services/realtime'
import type {
    Discipline,
    Category,
    Video,
    Instructor,
    DisciplineInsert,
    DisciplineUpdate,
    CategoryInsert,
    CategoryUpdate,
    VideoInsert,
    VideoUpdate,
    DisciplineWithRelations,
    CategoryWithRelations,
    VideoWithRelations,
    SubscriptionTier,
    VideoDifficulty,
    ProcessingStatus
} from 'shared/types/database'

/**
 * Interface for video data coming from the frontend (camelCase)
 * This will be transformed to snake_case for database insertion
 */
export interface VideoCreateData {
    id: string
    title: string
    description?: string | null
    slug: string
    categoryId: string
    disciplineId?: string // Not used in DB, but may come from frontend
    instructorId?: string | null
    duration?: number
    thumbnailUrl?: string | null
    subscriptionTier?: SubscriptionTier
    tags?: string[] | null
    status?: ProcessingStatus
    isPublished?: boolean
    viewCount?: number
    sortOrder?: number
    fileSize?: number
    // Additional frontend-specific fields
    categoryName?: string
    disciplineName?: string
    uploadDate?: string
    lastModified?: string
    completionRate?: number
}

// Re-export types for client-side usage
export type {
    Video,
    VideoInsert,
    VideoUpdate,
    Discipline,
    Category,
    Instructor,
    DisciplineInsert,
    DisciplineUpdate,
    CategoryInsert,
    CategoryUpdate,
    DisciplineWithRelations,
    CategoryWithRelations,
    VideoWithRelations,
    SubscriptionTier,
    VideoDifficulty,
    ProcessingStatus
}

// Service Types
export interface ContentFilters {
    search?: string
    disciplineId?: string
    categoryId?: string
    instructorId?: string
    subscriptionTier?: SubscriptionTier
    difficulty?: VideoDifficulty
    processingStatus?: ProcessingStatus
    isPublished?: boolean
    isActive?: boolean
}

export interface PaginationOptions {
    page?: number
    pageSize?: number
    orderBy?: string
    orderDirection?: 'asc' | 'desc'
}

export interface BulkOperationResult {
    success: boolean
    processed: number
    failed: number
    errors: string[]
}

export interface ContentStats {
    totalDisciplines: number
    totalCategories: number
    totalVideos: number
    publishedVideos: number
    processingVideos: number
    totalViewTime: number
    averageRating: number
}

export interface VideoAnalytics {
    videoId: string
    title: string
    viewCount: number
    completionRate: number
    averageWatchTime: number
    subscriberTierBreakdown: Record<SubscriptionTier, number>
    monthlyViews: Array<{ month: string; views: number }>
}

// Type for raw Supabase response with plural keys
interface VideoSupabaseResponse extends Video {
    categories?: Category & {
        disciplines?: Discipline
    }
    instructors?: Instructor
}

/**
 * Transform Supabase response to match TypeScript types
 * Converts plural keys (categories, disciplines, instructors) to singular (category, discipline, instructor)
 */
function transformVideoRelations(video: VideoSupabaseResponse): VideoWithRelations {
    const transformed: VideoWithRelations = {
        ...video,
        category: video.categories ? {
            ...video.categories,
            discipline: video.categories.disciplines
        } : undefined,
        instructor: video.instructors
    }

    return transformed
}

// Query Functions
export const contentQueries = {
    /**
     * Fetch all disciplines with optional categories
     */
    async fetchDisciplines(includeCategories = false): Promise<DisciplineWithRelations[]> {
        const supabase = createAdminClient()

        const { data, error } = includeCategories
            ? await supabase
                .from('disciplines')
                .select(`
                    *,
                    categories(*)
                `)
                .order('sort_order', { ascending: true })
            : await supabase
                .from('disciplines')
                .select('*')
                .order('sort_order', { ascending: true })

        if (error) {
            throw handleSupabaseError(error)
        }

        return (data || []) as DisciplineWithRelations[]
    },

    /**
     * Fetch categories for a specific discipline
     */
    async fetchCategories(
        disciplineId?: string,
        includeVideos = false
    ): Promise<CategoryWithRelations[]> {
        const supabase = createAdminClient()

        const selectClause = includeVideos ? `
            *,
            disciplines(*),
            videos(*)
        ` : `
            *,
            disciplines(*)
        `

        const baseQuery = supabase
            .from('categories')
            .select(selectClause)
            .order('sort_order', { ascending: true })

        const { data, error } = disciplineId
            ? await baseQuery.eq('discipline_id', disciplineId)
            : await baseQuery

        if (error) {
            throw handleSupabaseError(error)
        }

        return (data || []) as unknown as CategoryWithRelations[]
    },

    /**
     * Fetch videos with comprehensive filtering and pagination
     */
    async fetchVideos(
        filters: ContentFilters = {},
        pagination: PaginationOptions = {}
    ): Promise<{
        data: VideoWithRelations[]
        totalCount: number
        hasMore: boolean
    }> {
        const supabase = createAdminClient()
        const {
            page = 1,
            pageSize = 20,
            orderBy = 'created_at',
            orderDirection = 'desc'
        } = pagination

        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('videos')
            .select(`
                *,
                categories!category_id(
                    *,
                    disciplines!discipline_id(*)
                )
            `, { count: 'exact' })
            .range(from, to)
            .order(orderBy, { ascending: orderDirection === 'asc' })

        // Apply filters
        if (filters.search) {
            query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
        }
        if (filters.categoryId) {
            query = query.eq('category_id', filters.categoryId)
        }
        // Instructor relationship removed - instructor_id column may not exist
        // if (filters.instructorId) {
        //     query = query.eq('instructor_id', filters.instructorId)
        // }
        if (filters.subscriptionTier) {
            query = query.eq('tier_required', filters.subscriptionTier)
        }
        if (filters.difficulty) {
            query = query.eq('difficulty', filters.difficulty)
        }
        if (filters.processingStatus) {
            query = query.eq('processing_status', filters.processingStatus)
        }
        if (filters.isPublished !== undefined) {
            query = query.eq('is_published', filters.isPublished)
        }

        const { data, error, count } = await query

        if (error) {
            throw handleSupabaseError(error)
        }

        // Transform the data to match TypeScript types (singular keys)
        const transformedData = (data || []).map((video) => transformVideoRelations(video as VideoSupabaseResponse))

        return {
            data: transformedData,
            totalCount: count || 0,
            hasMore: (count || 0) > to + 1
        }
    },

    /**
     * Fetch single video by ID with all relations
     */
    async fetchVideoById(videoId: string): Promise<VideoWithRelations | null> {
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('videos')
            .select(`
                *,
                categories!category_id(
                    *,
                    disciplines!discipline_id(*)
                )
            `)
            .eq('id', videoId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw handleSupabaseError(error)
        }

        return transformVideoRelations(data as VideoSupabaseResponse)
    },

    /**
     * Fetch all instructors
     */
    async fetchInstructors(): Promise<Instructor[]> {
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('instructors')
            .select('*')
            .eq('is_active', true)
            .order('full_name', { ascending: true })

        if (error) {
            throw handleSupabaseError(error)
        }

        return data || []
    },

    /**
     * Get content statistics for dashboard
     * NOTE: This function requires admin access and should only be called server-side
     */
    async fetchContentStats(): Promise<ContentStats> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('fetchContentStats requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const [
            disciplinesResult,
            categoriesResult,
            videosResult,
            publishedResult,
            processingResult
        ] = await Promise.all([
            supabase.from('disciplines').select('id', { count: 'exact', head: true }),
            supabase.from('categories').select('id', { count: 'exact', head: true }),
            supabase.from('videos').select('id', { count: 'exact', head: true }),
            supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_published', true),
            supabase.from('videos').select('id', { count: 'exact', head: true }).eq('processing_status', 'processing')
        ])

        // Get total view time and average rating (placeholder - would need analytics table)
        const totalViewTime = 0 // TODO: Implement analytics tracking
        const averageRating = 0 // TODO: Implement rating system

        return {
            totalDisciplines: disciplinesResult.count || 0,
            totalCategories: categoriesResult.count || 0,
            totalVideos: videosResult.count || 0,
            publishedVideos: publishedResult.count || 0,
            processingVideos: processingResult.count || 0,
            totalViewTime,
            averageRating
        }
    }
}

// Mutation Functions
export const contentMutations = {
    /**
     * Create new video metadata
     * NOTE: This function requires admin access and should only be called server-side
     */
    async createVideo(videoData: VideoCreateData): Promise<Video> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('createVideo requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // Transform camelCase to snake_case for database insertion
        const dbVideoData: VideoInsert = {
            id: videoData.id,
            title: videoData.title,
            description: videoData.description || null,
            slug: videoData.slug,
            category_id: videoData.categoryId, // Transform camelCase to snake_case
            instructor_id: videoData.instructorId || null,
            cloudflare_video_id: videoData.id, // Use the Cloudflare video ID
            duration_seconds: videoData.duration || 0,
            thumbnail_url: videoData.thumbnailUrl || null,
            tier_required: videoData.subscriptionTier || 'none',
            tags: videoData.tags || null,
            processing_status: videoData.status || 'processing',
            is_published: videoData.isPublished || false,
            view_count: videoData.viewCount || 0,
            sort_order: videoData.sortOrder || 0
        }

        const { data, error } = await supabase
            .from('videos')
            .insert(dbVideoData)
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Update video information
     * NOTE: This function requires admin access and should only be called server-side
     */
    async updateVideo(videoId: string, updates: VideoUpdate): Promise<Video> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('updateVideo requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('videos')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId)
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Delete video and cleanup related data
     * NOTE: This function requires admin access and should only be called server-side
     */
    async deleteVideo(videoId: string): Promise<void> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('deleteVideo requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // Start transaction-like cleanup
        const { error: progressError } = await supabase
            .from('user_progress')
            .delete()
            .eq('video_id', videoId)

        if (progressError) {
            throw new Error(`Failed to cleanup user progress: ${handleSupabaseError(progressError)}`)
        }

        const { error: videoError } = await supabase
            .from('videos')
            .delete()
            .eq('id', videoId)

        if (videoError) {
            throw handleSupabaseError(videoError)
        }
    },

    /**
     * Create new discipline
     * NOTE: This function requires admin access and should only be called server-side
     */
    async createDiscipline(disciplineData: DisciplineInsert): Promise<Discipline> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('createDiscipline requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('disciplines')
            .insert({
                ...disciplineData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Update discipline
     * NOTE: This function requires admin access and should only be called server-side
     */
    async updateDiscipline(disciplineId: string, updates: DisciplineUpdate): Promise<Discipline> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('updateDiscipline requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('disciplines')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', disciplineId)
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Delete discipline and cleanup related data
     * NOTE: This function requires admin access and should only be called server-side
     */
    async deleteDiscipline(disciplineId: string): Promise<void> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('deleteDiscipline requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // First, check if discipline has any categories
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('id')
            .eq('discipline_id', disciplineId)

        if (categoriesError) {
            throw new Error(`Failed to check categories: ${handleSupabaseError(categoriesError)}`)
        }

        if (categories && categories.length > 0) {
            throw new Error('Cannot delete discipline with existing categories. Please remove all categories first.')
        }

        // Delete the discipline
        const { error: disciplineError } = await supabase
            .from('disciplines')
            .delete()
            .eq('id', disciplineId)

        if (disciplineError) {
            throw handleSupabaseError(disciplineError)
        }
    },

    /**
     * Create new category
     * NOTE: This function requires admin access and should only be called server-side
     */
    async createCategory(categoryData: CategoryInsert): Promise<Category> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('createCategory requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('categories')
            .insert({
                ...categoryData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Update category
     * NOTE: This function requires admin access and should only be called server-side
     */
    async updateCategory(categoryId: string, updates: CategoryUpdate): Promise<Category> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('updateCategory requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('categories')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', categoryId)
            .select()
            .single()

        if (error) {
            throw handleSupabaseError(error)
        }

        return data
    },

    /**
     * Delete category and cleanup related data
     * NOTE: This function requires admin access and should only be called server-side
     */
    async deleteCategory(categoryId: string): Promise<void> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('deleteCategory requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // First, check if category has any videos
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('id')
            .eq('category_id', categoryId)

        if (videosError) {
            throw new Error(`Failed to check videos: ${handleSupabaseError(videosError)}`)
        }

        if (videos && videos.length > 0) {
            throw new Error('Cannot delete category with existing videos. Please move or delete all videos first.')
        }

        // Delete the category
        const { error: categoryError } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId)

        if (categoryError) {
            throw handleSupabaseError(categoryError)
        }
    },

    /**
     * Merge categories by moving all videos from source categories to target category
     * NOTE: This function requires admin access and should only be called server-side
     */
    async mergeCategories(targetCategoryId: string, sourceCategoryIds: string[]): Promise<void> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('mergeCategories requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // Move all videos from source categories to target category
        for (const sourceCategoryId of sourceCategoryIds) {
            const { error: moveError } = await supabase
                .from('videos')
                .update({
                    category_id: targetCategoryId,
                    updated_at: new Date().toISOString()
                })
                .eq('category_id', sourceCategoryId)

            if (moveError) {
                throw new Error(`Failed to move videos from category ${sourceCategoryId}: ${handleSupabaseError(moveError)}`)
            }
        }

        // Delete the source categories
        const { error: deleteError } = await supabase
            .from('categories')
            .delete()
            .in('id', sourceCategoryIds)

        if (deleteError) {
            throw new Error(`Failed to delete source categories: ${handleSupabaseError(deleteError)}`)
        }
    },

    /**
     * Split category by creating new categories and distributing videos
     * NOTE: This function requires admin access and should only be called server-side
     */
    async splitCategory(
        sourceCategoryId: string,
        newCategories: Array<{
            name: string;
            slug: string;
            description?: string;
            videoIds: string[];
        }>
    ): Promise<Category[]> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('splitCategory requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // Get source category info
        const { data: sourceCategory, error: fetchError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', sourceCategoryId)
            .single()

        if (fetchError) {
            throw new Error(`Failed to fetch source category: ${handleSupabaseError(fetchError)}`)
        }

        const createdCategories: Category[] = []

        // Create new categories and move videos
        for (const newCat of newCategories) {
            // Create new category
            const { data: newCategory, error: createError } = await supabase
                .from('categories')
                .insert({
                    name: newCat.name,
                    slug: newCat.slug,
                    description: newCat.description,
                    discipline_id: sourceCategory.discipline_id,
                    is_active: true,
                    sort_order: sourceCategory.sort_order + 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single()

            if (createError) {
                throw new Error(`Failed to create category ${newCat.name}: ${handleSupabaseError(createError)}`)
            }

            createdCategories.push(newCategory)

            // Move specified videos to new category
            if (newCat.videoIds.length > 0) {
                const { error: moveError } = await supabase
                    .from('videos')
                    .update({
                        category_id: newCategory.id,
                        updated_at: new Date().toISOString()
                    })
                    .in('id', newCat.videoIds)

                if (moveError) {
                    throw new Error(`Failed to move videos to category ${newCat.name}: ${handleSupabaseError(moveError)}`)
                }
            }
        }

        return createdCategories
    },

    /**
     * Reorder content items (disciplines, categories, or videos)
     * NOTE: This function requires admin access and should only be called server-side
     */
    async reorderContent(
        table: 'disciplines' | 'categories' | 'videos',
        reorderData: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('reorderContent requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        const updates = reorderData.map(item =>
            supabase
                .from(table)
                .update({
                    sort_order: item.sort_order,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id)
        )

        const results = await Promise.allSettled(updates)
        const failed = results.filter(result => result.status === 'rejected')

        if (failed.length > 0) {
            throw new Error(`Failed to reorder ${failed.length} items`)
        }
    }
}

// Admin Features
export const adminFeatures = {
    /**
     * Bulk update video status
     * NOTE: This function requires admin access and should only be called server-side
     */
    async bulkUpdateVideoStatus(
        videoIds: string[],
        updates: { is_published?: boolean; processing_status?: ProcessingStatus }
    ): Promise<BulkOperationResult> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('bulkUpdateVideoStatus requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()
        const results: BulkOperationResult = {
            success: false,
            processed: 0,
            failed: 0,
            errors: []
        }

        for (const videoId of videoIds) {
            try {
                const { error } = await supabase
                    .from('videos')
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', videoId)

                if (error) {
                    results.failed++
                    results.errors.push(`Video ${videoId}: ${handleSupabaseError(error)}`)
                } else {
                    results.processed++
                }
            } catch (error) {
                results.failed++
                results.errors.push(`Video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        results.success = results.failed === 0
        return results
    },

    /**
     * Bulk delete videos
     * NOTE: This function requires admin access and should only be called server-side
     */
    async bulkDeleteVideos(videoIds: string[]): Promise<BulkOperationResult> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('bulkDeleteVideos requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const results: BulkOperationResult = {
            success: false,
            processed: 0,
            failed: 0,
            errors: []
        }

        for (const videoId of videoIds) {
            try {
                await contentMutations.deleteVideo(videoId)
                results.processed++
            } catch (error) {
                results.failed++
                results.errors.push(`Video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        results.success = results.failed === 0
        return results
    },

    /**
     * Get video analytics
     * NOTE: This function requires admin access and should only be called server-side
     */
    async getVideoAnalytics(videoId: string): Promise<VideoAnalytics> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            throw new Error('getVideoAnalytics requires admin access and cannot be used in browser environment - use server-side API routes instead')
        }

        const supabase = createAdminClient()

        // Get basic video info and progress data
        const { data: video, error: videoError } = await supabase
            .from('videos')
            .select(`
                id,
                title,
                view_count,
                user_progress(
                    progress_percentage,
                    completed,
                    user_id
                )
            `)
            .eq('id', videoId)
            .single()

        if (videoError) {
            throw handleSupabaseError(videoError)
        }

        const progress = video.user_progress || []
        const completedViews = progress.filter(p => p.completed).length
        const totalViews = progress.length
        const completionRate = totalViews > 0 ? (completedViews / totalViews) * 100 : 0

        // Calculate average watch time
        const averageProgress = progress.length > 0
            ? progress.reduce((sum, p) => sum + p.progress_percentage, 0) / progress.length
            : 0

        // Subscriber tier breakdown (placeholder - would need proper user data)
        const subscriberTierBreakdown: Record<SubscriptionTier, number> = {
            none: Math.floor(totalViews * 0.1),
            tier1: Math.floor(totalViews * 0.4),
            tier2: Math.floor(totalViews * 0.3),
            tier3: Math.floor(totalViews * 0.2)
        }

        // Monthly views (placeholder - would need proper analytics tracking)
        const monthlyViews = [
            { month: '2024-01', views: Math.floor(totalViews * 0.1) },
            { month: '2024-02', views: Math.floor(totalViews * 0.15) },
            { month: '2024-03', views: Math.floor(totalViews * 0.25) },
            { month: '2024-04', views: Math.floor(totalViews * 0.5) }
        ]

        return {
            videoId: video.id,
            title: video.title,
            viewCount: video.view_count,
            completionRate,
            averageWatchTime: averageProgress,
            subscriberTierBreakdown,
            monthlyViews
        }
    },

    /**
     * Search content across all types
     */
    async searchContent(
        query: string
    ): Promise<{
        disciplines: DisciplineWithRelations[]
        categories: CategoryWithRelations[]
        videos: VideoWithRelations[]
    }> {
        const supabase = createAdminClient()

        const [disciplinesResult, categoriesResult, videosResult] = await Promise.all([
            supabase
                .from('disciplines')
                .select('*, categories(*)')
                .ilike('name', `%${query}%`)
                .eq('is_active', true)
                .limit(10),

            supabase
                .from('categories')
                .select('*, discipline(*)')
                .ilike('name', `%${query}%`)
                .eq('is_active', true)
                .limit(10),

            supabase
                .from('videos')
                .select(`
                    *,
                    categories!category_id(*, disciplines!discipline_id(*))
                `)
                .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(20)
        ])

        return {
            disciplines: (disciplinesResult.data || []) as DisciplineWithRelations[],
            categories: (categoriesResult.data || []) as CategoryWithRelations[],
            videos: (videosResult.data || []) as VideoWithRelations[]
        }
    }
}

// Create realtime service instance - using client component client instead of admin client for browser safety
const getRealtime = () => {
    if (typeof window !== 'undefined') {
        return new RealtimeService(createClientComponentClient())
    }
    return new RealtimeService(createAdminClient())
}

// Real-time Updates
export const contentSubscriptions = {
    /**
     * Subscribe to video processing status changes
     */
    subscribeToVideoProcessing(callback: (video: Video) => void) {
        return getRealtime().subscribeToTable(
            'videos',
            (payload: { eventType: string; new?: Partial<Video>; old?: Partial<Video> }) => {
                if (
                    payload.eventType === 'UPDATE' &&
                    payload.new &&
                    (payload.new as Video).processing_status !==
                    (payload.old as Partial<Video>)?.processing_status
                ) {
                    callback(payload.new as Video)
                }
            }
        )
    },

    /**
     * Subscribe to content changes for real-time dashboard updates
     */
    subscribeToContentChanges(callback: (payload: unknown) => void) {
        const supabase = createClientComponentClient()

        const channel = supabase
            .channel('content_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'videos'
            }, callback)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'categories'
            }, callback)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'disciplines'
            }, callback)
            .subscribe()

        return {
            subscription: channel,
            unsubscribe: () => channel.unsubscribe()
        }
    }
}

// Export service object for easy importing
export const contentService = {
    queries: contentQueries,
    mutations: contentMutations,
    admin: adminFeatures,
    subscriptions: contentSubscriptions
}

export default contentService 