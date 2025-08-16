/**
 * Evolution Combatives - Client-side Content Management Service
 * Calls API routes instead of using createAdminClient directly
 * 
 * @description Client-safe content service for browser environments
 * @author Evolution Combatives
 */

import type {
    Video,
    VideoInsert,
    VideoUpdate,
    BulkOperationResult,
    ContentStats,
    VideoAnalytics,
    Category,
    Discipline,
} from './content'

// CSRF token cache
let csrfTokenCache: { token: string; expires: number } | null = null

/**
 * Get CSRF token for API requests
 */
async function getCSRFToken(): Promise<string> {
    // Check cache first
    if (csrfTokenCache && Date.now() < csrfTokenCache.expires) {
        return csrfTokenCache.token
    }

    try {
        const response = await fetch('/api/csrf-token')
        const result = await response.json()
        
        if (!result.success) {
            throw new Error('Failed to get CSRF token')
        }

        // Cache token for 23 hours (less than cookie expiry)
        csrfTokenCache = {
            token: result.csrfToken,
            expires: Date.now() + (23 * 60 * 60 * 1000)
        }

        return result.csrfToken
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error)
        throw error
    }
}

/**
 * Create headers with CSRF token for API requests
 */
async function createSecureHeaders(): Promise<HeadersInit> {
    const csrfToken = await getCSRFToken()
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
    }
}

// Client-safe API calls
export const clientContentService = {

    async fetchCategories(): Promise<Category[]> {
        const response = await fetch('/api/content/categories')
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },
    

    async fetchDisciplines(): Promise<Discipline[]> {
        const response = await fetch('/api/content/disciplines')
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },
    

    /**
     * Fetch videos with filtering and pagination
     */
    async fetchVideos(
        filters: { search?: string; categoryId?: string } = {},
        pagination: { page?: number; pageSize?: number } = {}
    ): Promise<{
        data: Video[]
        totalCount: number
        hasMore: boolean
    }> {
        const searchParams = new URLSearchParams()
        if (filters.search) searchParams.set('search', filters.search)
        if (filters.categoryId) searchParams.set('categoryId', filters.categoryId)
        if (pagination.page !== undefined) searchParams.set('page', pagination.page.toString())
        if (pagination.pageSize !== undefined) searchParams.set('pageSize', pagination.pageSize.toString())
        
        const response = await fetch(`/api/content/videos?${searchParams}`)
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    /**
     * Fetch single video by ID
     */
    async fetchVideoById(videoId: string): Promise<Video> {
        const response = await fetch(`/api/content/videos/${videoId}`)
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    /**
     * Get content statistics for dashboard
     */
    async fetchContentStats(): Promise<ContentStats> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'fetchContentStats' })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    },

    /**
     * Create new video metadata
     */
    async createVideo(videoData: VideoInsert): Promise<Video> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'createVideo', videoData })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    },

    /**
     * Update video information
     */
    async updateVideo(videoId: string, updates: VideoUpdate): Promise<Video> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'updateVideo', videoId, updates })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    },

    /**
     * Delete video and cleanup related data
     */
    async deleteVideo(videoId: string): Promise<void> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'deleteVideo', videoId })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
    },

    /**
     * Bulk update video status
     */
    async bulkUpdateVideoStatus(
        videoIds: string[],
        updates: { is_published?: boolean; processing_status?: string }
    ): Promise<BulkOperationResult> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'bulkUpdateVideoStatus', videoIds, updates })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    },

    /**
     * Bulk delete videos
     */
    async bulkDeleteVideos(videoIds: string[]): Promise<BulkOperationResult> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'bulkDeleteVideos', videoIds })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    },

    /**
     * Get video analytics
     */
    async getVideoAnalytics(videoId: string): Promise<VideoAnalytics> {
        const response = await fetch('/api/admin/content', {
            method: 'POST',
            headers: await createSecureHeaders(),
            body: JSON.stringify({ action: 'getVideoAnalytics', videoId })
        })

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }

        return result.data
    }
}

export default clientContentService