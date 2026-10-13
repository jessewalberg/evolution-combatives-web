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
    CategoryInsert,
    CategoryUpdate,
    Discipline,
    DisciplineInsert,
    DisciplineUpdate,
} from './content'
import { fetchWithCSRF } from '@/src/lib/csrf-client'

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

    // Discipline Mutations
    async createDiscipline(data: DisciplineInsert): Promise<Discipline> {
        const response = await fetchWithCSRF('/api/content/disciplines', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    async updateDiscipline(id: string, data: DisciplineUpdate): Promise<Discipline> {
        const response = await fetchWithCSRF(`/api/content/disciplines/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    async deleteDiscipline(id: string): Promise<void> {
        const response = await fetchWithCSRF(`/api/content/disciplines/${id}`, {
            method: 'DELETE',
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
    },

    // Category Mutations
    async createCategory(data: CategoryInsert): Promise<Category> {
        const response = await fetchWithCSRF('/api/content/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    async updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
        const response = await fetchWithCSRF(`/api/content/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
        return result.data
    },

    async deleteCategory(id: string): Promise<void> {
        const response = await fetchWithCSRF(`/api/content/categories/${id}`, {
            method: 'DELETE',
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
    },

    async reorderCategories(reorderData: Array<{ id: string; sort_order: number }>): Promise<void> {
        const response = await fetchWithCSRF('/api/content/categories/reorder', {
            method: 'POST',
            body: JSON.stringify({ reorderData })
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
    },

    async mergeCategories(targetId: string, sourceIds: string[]): Promise<void> {
        const response = await fetchWithCSRF('/api/content/categories/merge', {
            method: 'POST',
            body: JSON.stringify({ targetId, sourceIds })
        })
        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error)
        }
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
        const response = await fetchWithCSRF('/api/admin/content', {
            method: 'POST',
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
