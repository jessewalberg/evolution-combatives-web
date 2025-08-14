/**
 * Evolution Combatives - TanStack Query Configuration
 * Comprehensive query client setup for Next.js admin dashboard
 * 
 * @description Query client configuration with type-safe keys and optimized caching
 * @author Evolution Combatives
 */

import { QueryClient, DefaultOptions, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
    ContentFilters,
    PaginationOptions
} from '../services/content'
import type {
    ProcessingStatus,
    VideoWithRelations,
    CategoryWithRelations,
    DisciplineWithRelations,
    Video,
    Category,
    Discipline,
    Instructor
} from 'shared/types/database'

// Error types for better type safety
export interface QueryError {
    message: string
    status?: number
    code?: string | number
    details?: unknown
}

// Data structure types for query responses
export interface PaginatedResponse<T> {
    data: T[]
    totalCount: number
    hasMore: boolean
}

export type VideoListData = PaginatedResponse<VideoWithRelations>
export type CategoryListData = CategoryWithRelations[]
export type DisciplineListData = DisciplineWithRelations[]

// Real-time change types
export type DatabaseRecord = Video | Category | Discipline | Instructor
export type RealtimeChange = {
    table: 'videos' | 'categories' | 'disciplines' | 'instructors'
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: DatabaseRecord
    old?: DatabaseRecord
}

// Query filter types (more specific than Record<string, unknown>)
export type QueryFilters = {
    [key: string]: string | number | boolean | string[] | number[] | null | undefined
}

// Query Key Types
export interface BaseQueryKey {
    scope: string
    entity?: string
    id?: string | number
    filters?: QueryFilters
    pagination?: PaginationOptions
}

// Standardized Query Key Factories
export const queryKeys = {
    // Base keys for hierarchical invalidation
    all: ['evolution-combatives'] as const,

    // Content queries
    content: () => [...queryKeys.all, 'content'] as const,
    contentStats: () => [...queryKeys.content(), 'stats'] as const,

    // Disciplines
    disciplines: () => [...queryKeys.content(), 'disciplines'] as const,
    disciplinesList: (includeCategories?: boolean) =>
        [...queryKeys.disciplines(), 'list', { includeCategories }] as const,
    disciplineDetail: (id: string) =>
        [...queryKeys.disciplines(), 'detail', id] as const,

    // Categories
    categories: () => [...queryKeys.content(), 'categories'] as const,
    categoriesList: (disciplineId?: string, includeVideos?: boolean) =>
        [...queryKeys.categories(), 'list', { disciplineId, includeVideos }] as const,
    categoryDetail: (id: string) =>
        [...queryKeys.categories(), 'detail', id] as const,

    // Videos
    videos: () => [...queryKeys.content(), 'videos'] as const,
    videosList: (filters?: ContentFilters, pagination?: PaginationOptions) =>
        [...queryKeys.videos(), 'list', { filters, pagination }] as const,
    videoDetail: (id: string) =>
        [...queryKeys.videos(), 'detail', id] as const,
    videoAnalytics: (id: string) =>
        [...queryKeys.videos(), 'analytics', id] as const,

    // Instructors
    instructors: () => [...queryKeys.content(), 'instructors'] as const,
    instructorsList: () => [...queryKeys.instructors(), 'list'] as const,
    instructorDetail: (id: string) =>
        [...queryKeys.instructors(), 'detail', id] as const,

    // Users and Admin
    users: () => [...queryKeys.all, 'users'] as const,
    usersList: (page?: number, pageSize?: number) =>
        [...queryKeys.users(), 'list', { page, pageSize }] as const,
    userDetail: (id: string) =>
        [...queryKeys.users(), 'detail', id] as const,
    userProfile: () => [...queryKeys.users(), 'profile'] as const,

    // Cloudflare Stream
    stream: () => [...queryKeys.all, 'stream'] as const,
    streamVideo: (id: string) =>
        [...queryKeys.stream(), 'video', id] as const,
    streamUpload: (id: string) =>
        [...queryKeys.stream(), 'upload', id] as const,

    // Search
    search: (query: string, type?: 'all' | 'videos' | 'categories' | 'disciplines') =>
        [...queryKeys.all, 'search', { query, type }] as const,

    // Real-time subscriptions
    subscriptions: () => [...queryKeys.all, 'subscriptions'] as const,
} as const

// Type-safe query key helper
export type QueryKeys = typeof queryKeys
export type QueryKeyResult<T extends (...args: (string | number | boolean | object | null | undefined)[]) => readonly (string | number | object)[]> = ReturnType<T>

// Default Query Options
const queryDefaults: DefaultOptions = {
    queries: {
        // Stale time based on data volatility
        staleTime: 1000 * 60 * 15, // 15 minutes default - admin data doesn't change frequently

        // Garbage collection - keep unused data for 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes - keep data longer for better UX

        // Retry configuration
        retry: (failureCount, error: unknown) => {
            const err = error as QueryError
            // Don't retry on 4xx errors (client errors)
            if (err?.status && err.status >= 400 && err.status < 500) {
                return false
            }
            // Retry up to 3 times for other errors
            return failureCount < 3
        },

        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Background refetch on window focus
        refetchOnWindowFocus: false, // Disable to prevent unnecessary refetches when switching tabs

        // Refetch on network reconnect
        refetchOnReconnect: true,

        // Don't refetch on mount if data is fresh
        refetchOnMount: false, // Use cached data if available

        // Network mode - continue with cached data when offline
        networkMode: 'offlineFirst',
    },
    mutations: {
        // Retry mutations once on network error
        retry: (failureCount, error: unknown) => {
            const err = error as QueryError
            if (err?.status && err.status >= 400 && err.status < 500) {
                return false
            }
            return failureCount < 1
        },

        // Network mode for mutations
        networkMode: 'online',
    },
}

// Specialized stale times for different data types
export const staleTimeConfig = {
    // Static/rarely changing data - 30 minutes
    static: 1000 * 60 * 60, // 1 hour - static data rarely changes

    // Content data - 10 minutes
    content: 1000 * 60 * 20, // 20 minutes - content doesn't change frequently

    // User data - 5 minutes
    users: 1000 * 60 * 15, // 15 minutes - user data is fairly stable

    // Real-time data - 30 seconds
    realtime: 1000 * 30,

    // Analytics - 2 minutes
    analytics: 1000 * 60 * 10, // 10 minutes - analytics don't need to be super fresh

    // Video processing status - 10 seconds
    processing: 1000 * 10,

    // Search results - 2 minutes
    search: 1000 * 60 * 2,
} as const

// Error handling for queries
function handleQueryError(error: unknown, queryKey: QueryKey) {
    if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Query error:', { error, queryKey })
    }

    const err = error as QueryError

    // User-friendly error messages
    let message = 'Something went wrong. Please try again.'

    if (err?.message?.includes('Failed to fetch')) {
        message = 'Network error. Please check your connection.'
    } else if (err?.message?.includes('Authentication expired')) {
        message = 'Your session has expired. Please sign in again.'
        // TODO: Redirect to login
    } else if (err?.message?.includes('Permission denied')) {
        message = 'You do not have permission to access this data.'
    } else if (err?.status === 429) {
        message = 'Too many requests. Please wait a moment and try again.'
    } else if (err?.status && err.status >= 500) {
        message = 'Server error. Please try again later.'
    }

    // Show toast notification for errors
    toast.error(message, {
        description: process.env.NODE_ENV === 'development' ? err?.message : undefined,
        action: {
            label: 'Retry',
            onClick: () => window.location.reload(),
        },
    })
}

// Create Query Client with optimized configuration
export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: queryDefaults,
    })
}

// Global query client instance (for app directory)
let clientSingleton: QueryClient | undefined

export function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') {
        // Server-side: always create a new client
        return createQueryClient()
    }

    // Client-side: use singleton pattern
    if (!clientSingleton) {
        clientSingleton = createQueryClient()
    }

    return clientSingleton
}

// Query Client Provider wrapper for error handling
export class QueryErrorBoundary {
    static handleError(error: unknown, queryKey: QueryKey) {
        handleQueryError(error, queryKey)
    }
}

// Optimistic Update Helpers
export const optimisticUpdates = {
    /**
     * Update video in videos list optimistically
     */
    updateVideoInList: (
        queryClient: QueryClient,
        videoId: string,
        updateFn: (oldVideo: VideoWithRelations) => VideoWithRelations,
        filters?: ContentFilters,
        pagination?: PaginationOptions
    ) => {
        const queryKey = queryKeys.videosList(filters, pagination)

        queryClient.setQueryData(queryKey, (old: VideoListData | undefined) => {
            if (!old?.data) return old

            return {
                ...old,
                data: old.data.map((video) =>
                    video.id === videoId ? updateFn(video) : video
                )
            }
        })
    },

    /**
     * Add new video to list optimistically
     */
    addVideoToList: (
        queryClient: QueryClient,
        newVideo: VideoWithRelations,
        filters?: ContentFilters,
        pagination?: PaginationOptions
    ) => {
        const queryKey = queryKeys.videosList(filters, pagination)

        queryClient.setQueryData(queryKey, (old: VideoListData | undefined) => {
            if (!old?.data) return old

            return {
                ...old,
                data: [newVideo, ...old.data],
                totalCount: old.totalCount + 1
            }
        })
    },

    /**
     * Remove video from list optimistically
     */
    removeVideoFromList: (
        queryClient: QueryClient,
        videoId: string,
        filters?: ContentFilters,
        pagination?: PaginationOptions
    ) => {
        const queryKey = queryKeys.videosList(filters, pagination)

        queryClient.setQueryData(queryKey, (old: VideoListData | undefined) => {
            if (!old?.data) return old

            return {
                ...old,
                data: old.data.filter((video) => video.id !== videoId),
                totalCount: Math.max(0, old.totalCount - 1)
            }
        })
    }
}

// Cache Invalidation Helpers
export const cacheUtils = {
    /**
     * Invalidate all content-related queries
     */
    invalidateContent: (queryClient: QueryClient) => {
        return queryClient.invalidateQueries({
            queryKey: queryKeys.content()
        })
    },

    /**
     * Invalidate video-related queries
     */
    invalidateVideo: (queryClient: QueryClient, videoId?: string) => {
        if (videoId) {
            return Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.videoDetail(videoId)
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.videoAnalytics(videoId)
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.videos()
                })
            ])
        }

        return queryClient.invalidateQueries({
            queryKey: queryKeys.videos()
        })
    },

    /**
     * Invalidate user-related queries
     */
    invalidateUsers: (queryClient: QueryClient, userId?: string) => {
        if (userId) {
            return Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.userDetail(userId)
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users()
                })
            ])
        }

        return queryClient.invalidateQueries({
            queryKey: queryKeys.users()
        })
    },

    /**
     * Clear all cache (nuclear option)
     */
    clearAll: (queryClient: QueryClient) => {
        return queryClient.clear()
    }
}

// Real-time Update Helpers
export const realtimeUtils = {
    /**
     * Handle real-time video processing updates
     */
    handleVideoProcessingUpdate: (
        queryClient: QueryClient,
        videoUpdate: { id: string; processing_status: ProcessingStatus }
    ) => {
        // Update specific video detail
        queryClient.setQueryData(
            queryKeys.videoDetail(videoUpdate.id),
            (old: VideoWithRelations | undefined) => old ? { ...old, processing_status: videoUpdate.processing_status } : undefined
        )

        // Update video in all relevant lists
        queryClient.invalidateQueries({
            queryKey: queryKeys.videos(),
            type: 'active'
        })

        // Show toast notification for processing completion
        if (videoUpdate.processing_status === 'ready') {
            toast.success('Video processing completed!', {
                description: 'Video is now ready for publishing.'
            })
        } else if (videoUpdate.processing_status === 'error') {
            toast.error('Video processing failed', {
                description: 'Please check the video file and try again.'
            })
        }
    },

    /**
     * Handle real-time content changes
     */
    handleContentChange: (
        queryClient: QueryClient,
        change: RealtimeChange
    ) => {
        switch (change.table) {
            case 'videos':
                queryClient.invalidateQueries({
                    queryKey: queryKeys.videos()
                })
                break
            case 'categories':
                queryClient.invalidateQueries({
                    queryKey: queryKeys.categories()
                })
                break
            case 'disciplines':
                queryClient.invalidateQueries({
                    queryKey: queryKeys.disciplines()
                })
                break
            default:
                break
        }
    }
}

// Development helpers
export const devUtils = {
    /**
     * Log all active queries (development only)
     */
    logQueries: (queryClient: QueryClient) => {
        if (process.env.NODE_ENV === 'development') {
            const queryCache = queryClient.getQueryCache()
            // eslint-disable-next-line no-console
            console.table(
                queryCache.getAll().map(query => ({
                    queryKey: JSON.stringify(query.queryKey),
                    state: query.state.status,
                    dataUpdatedAt: new Date(query.state.dataUpdatedAt).toLocaleTimeString(),
                    gcTime: query.options.gcTime,
                }))
            )
        }
    },

    /**
     * Clear specific query pattern (development only)
     */
    clearPattern: (queryClient: QueryClient, pattern: string) => {
        if (process.env.NODE_ENV === 'development') {
            queryClient.invalidateQueries({
                predicate: (query) =>
                    JSON.stringify(query.queryKey).includes(pattern)
            })
        }
    }
}

// Export default query client
export default getQueryClient() 