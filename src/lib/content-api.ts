/**
 * Client-side helper functions for Content API
 * These functions make secure API calls to server-side endpoints
 */

interface ContentApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

export class ContentApiClient {
    private async makeRequest<T>(endpoint: string, action: string, data?: any): Promise<T> {
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

    async createVideo(videoData: any): Promise<any> {
        return this.makeRequest('/api/content/videos', 'create', { videoData })
    }

    async updateVideo(id: string, updateData: any): Promise<any> {
        return this.makeRequest('/api/content/videos', 'update', { id, updateData })
    }

    async fetchCategories(): Promise<any[]> {
        return this.makeGetRequest('/api/content/categories')
    }

    async fetchDisciplines(): Promise<any[]> {
        return this.makeGetRequest('/api/content/disciplines')
    }
}

export const contentApi = new ContentApiClient()