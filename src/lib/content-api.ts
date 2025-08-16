/**
 * Client-side helper functions for Content API
 * These functions make secure API calls to server-side endpoints
 */

import { Video } from "../components/video"
import { Category, Discipline } from "./shared"

interface ContentApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

export class ContentApiClient {
    private async makeRequest<T>(endpoint: string, action: string, data?: Record<string, unknown>): Promise<T> {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                ...data
            })
        })

        const responseText = await response.text()
        let result: ContentApiResponse<T>
        try {
            result = JSON.parse(responseText)
        } catch (parseError) {
            throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`)
        }

        if (!result.success) {
            throw new Error(result.error || 'API request failed')
        }

        return result.data!
    }

    private async makeGetRequest<T>(endpoint: string): Promise<T> {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })

        const responseText = await response.text()
        let result: ContentApiResponse<T>
        try {
            result = JSON.parse(responseText)
        } catch (parseError) {
            throw new Error(`API returned non-JSON response: ${responseText.substring(0, 200)}`)
        }

        if (!result.success) {
            throw new Error(result.error || 'API request failed')
        }

        return result.data!
    }

    async createVideo(videoData: Video): Promise<Video> {
        return this.makeRequest('/api/content/videos', 'create', { videoData })
    }

    async updateVideo(id: string, updateData: Partial<Video>): Promise<Video> {
        return this.makeRequest('/api/content/videos', 'update', { id, updateData })
    }

    async fetchCategories(): Promise<Category[]> {
        return this.makeGetRequest('/api/content/categories')
    }

    async fetchDisciplines(): Promise<Discipline[]> {
        return this.makeGetRequest('/api/content/disciplines')
    }
}

export const contentApi = new ContentApiClient()