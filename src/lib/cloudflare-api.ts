/**
 * Client-side helper functions for Cloudflare Stream API
 * These functions make secure API calls to server-side endpoints
 */

interface CloudflareApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

export class CloudflareApiClient {
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

    private async makeRequest<T>(action: string, data?: Record<string, unknown>): Promise<T> {
        const csrfToken = await this.getCSRFToken()

        const response = await fetch('/api/cloudflare/upload', {
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
        let result: CloudflareApiResponse<T>
        try {
            result = JSON.parse(responseText)
        } catch (parseError) {
            throw new Error(`Cloudflare API returned non-JSON response: ${responseText.substring(0, 200)}`)
        }

        // If CSRF validation failed, clear cache and retry once
        if (!result.success && result.error?.includes('CSRF token validation failed')) {
            this.csrfTokenCache = null // Clear cache

            // Retry once with fresh token
            const freshToken = await this.getCSRFToken()
            const retryResponse = await fetch('/api/cloudflare/upload', {
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
                throw new Error(`Cloudflare API returned non-JSON response on retry: ${retryResponseText.substring(0, 200)}`)
            }
        }

        if (!result.success) {
            throw new Error(result.error || 'API request failed')
        }

        return result.data!
    }

    async getUploadUrl(options: {
        maxDurationSeconds?: number
        requireSignedURLs?: boolean
        allowedOrigins?: string[]
        thumbnailTimestampPct?: number
        creator?: string
        expiry?: string
        scheduledDeletion?: string
        metadata?: Record<string, string>
    } = {}): Promise<{
        uploadUrl: string
        videoId: string
    }> {
        return this.makeRequest('getUploadUrl', options)
    }

    async uploadVideo(
        file: File | Blob,
        uploadUrl: string,
        onProgress?: (progress: number) => void,
        abortSignal?: AbortSignal
    ): Promise<void> {
        const formData = new FormData()
        formData.append('file', file)

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            // Handle abort signal
            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    xhr.abort()
                    reject(new Error('Upload cancelled'))
                })
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const progress = (event.loaded / event.total) * 100
                    onProgress(progress)
                }
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve()
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`))
                }
            }

            xhr.onerror = () => {
                reject(new Error('Network error during upload'))
            }

            xhr.onabort = () => {
                reject(new Error('Upload cancelled'))
            }

            xhr.open('POST', uploadUrl)
            xhr.send(formData)
        })
    }

    async checkUploadStatus(streamId: string): Promise<CloudflareApiResponse> {
        return this.makeRequest('checkUploadStatus', { streamId })
    }

    async generateAdminPreviewUrl(videoId: string): Promise<string> {
        const result = await this.makeRequest<{ previewUrl: string }>('generateAdminPreviewUrl', { videoId })
        return result.previewUrl
    }

    async generateThumbnailUrl(
        videoId: string,
        options: {
            time?: number
            width?: number
            height?: number
            fit?: 'clip' | 'crop' | 'pad' | 'scale-down'
        } = {}
    ): Promise<string> {
        const result = await this.makeRequest<{ thumbnailUrl: string }>('generateThumbnailUrl', { videoId, options })
        return result.thumbnailUrl
    }

    async retryProcessing(videoId: string): Promise<void> {
        await this.makeRequest('retryProcessing', { videoId })
    }
}

export const cloudflareApi = new CloudflareApiClient()