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
    private csrfTokenCache: { token: string; expires: number } | null = null

    private async getCSRFToken(): Promise<string> {
        // Check if we have a cached token that hasn't expired
        if (this.csrfTokenCache && Date.now() < this.csrfTokenCache.expires) {
            return this.csrfTokenCache.token
        }

        const response = await fetch('/api/csrf-token', {
            credentials: 'include' // Ensure cookies are included
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success || !data.csrfToken) {
            throw new Error('Failed to get CSRF token from response')
        }

        // Cache the token with expiration
        this.csrfTokenCache = {
            token: data.csrfToken,
            expires: new Date(data.expiresAt).getTime() - 60000 // Expire 1 minute early for safety
        }

        return data.csrfToken
    }

    private async makeRequest<T>(endpoint: string, action: string, data?: Record<string, unknown>): Promise<T> {
        const csrfToken = await this.getCSRFToken()

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            credentials: 'include', // Ensure cookies are included
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

        // If CSRF validation failed, clear cache and retry once
        if (!result.success && result.error?.includes('CSRF token validation failed')) {
            this.csrfTokenCache = null // Clear cache

            // Retry once with fresh token
            const freshToken = await this.getCSRFToken()
            const retryResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': freshToken,
                },
                credentials: 'include',
                body: JSON.stringify({
                    action,
                    ...data
                })
            })

            const retryResponseText = await retryResponse.text()
            try {
                result = JSON.parse(retryResponseText)
            } catch (parseError) {
                throw new Error(`API returned non-JSON response on retry: ${retryResponseText.substring(0, 200)}`)
            }
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