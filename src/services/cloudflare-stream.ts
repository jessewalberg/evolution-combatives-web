/**
 * Evolution Combatives - Cloudflare Stream API Integration
 * Direct API integration for video upload, management, and streaming
 * 
 * @description Cloudflare Stream service for admin dashboard video operations
 * @author Evolution Combatives
 */

import { createAdminClient } from '../lib/supabase'
import { handleSupabaseError } from '../lib/shared/utils/supabase-errors'
import type {
    VideoUpdate,
    ProcessingStatus,
    SubscriptionTier
} from 'shared/types/database'

/**
 * Cloudflare Stream credentials, resolved lazily and server-side only. On
 * Workers, env vars are only guaranteed present at request time, and this
 * module is also bundled for the browser (direct-upload XHR path), where
 * process.env does not exist.
 */
function getStreamEnv(): { accountId: string; apiToken: string; customerSubdomain: string } {
    if (typeof window !== 'undefined') {
        throw new Error('Cloudflare Stream API credentials are server-side only')
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const customerSubdomain = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN

    if (!accountId || !apiToken || !customerSubdomain || accountId.startsWith('PLACEHOLDER_') || customerSubdomain.startsWith('PLACEHOLDER_')) {
        const missing = []
        if (!accountId || accountId.startsWith('PLACEHOLDER_')) missing.push('CLOUDFLARE_ACCOUNT_ID')
        if (!apiToken) missing.push('CLOUDFLARE_API_TOKEN')
        if (!customerSubdomain || customerSubdomain.startsWith('PLACEHOLDER_')) missing.push('CLOUDFLARE_CUSTOMER_SUBDOMAIN')
        throw new Error(`Missing Cloudflare environment variables: ${missing.join(', ')}`)
    }

    return { accountId, apiToken, customerSubdomain }
}

// Cloudflare Stream API Types
export interface StreamUploadResponse {
    result: {
        uid: string
        uploadURL: string
        watermark?: {
            uid: string
        }
    }
    success: boolean
    errors: Array<{ code: number; message: string }>
    messages: string[]
}

export interface StreamVideoMetadata {
    uid: string
    thumbnail: string
    thumbnailTimestampPct: number
    readyToStream: boolean
    status: {
        state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error'
        pctComplete: string
        errorReasonCode?: string
        errorReasonText?: string
    }
    meta: {
        downloaded_from?: string
        name?: string
    }
    labels?: string[]
    created: string
    modified: string
    size?: number
    preview: string
    allowedOrigins?: string[]
    requireSignedURLs: boolean
    uploaded: string
    uploadExpiry?: string
    maxSizeBytes?: number
    maxDurationSeconds?: number
    duration?: number
    input: {
        width?: number
        height?: number
    }
    playback?: {
        hls: string
        dash: string
    }
    watermark?: {
        uid: string
        size: number
        height: number
        width: number
        created: string
        downloadedFrom: string
        name: string
        opacity: number
        padding: number
        position: string
        scale: number
    }
}

export interface StreamVideoListResponse {
    result: StreamVideoMetadata[]
    success: boolean
    errors: Array<{ code: number; message: string }>
    messages: string[]
    result_info: {
        page: number
        per_page: number
        count: number
        total_count: number
    }
}

export interface SignedUrlOptions {
    exp?: number // Expiration timestamp
    nbf?: number // Not before timestamp
    downloadable?: boolean
    accessRules?: Array<{
        type: 'ip' | 'ip.geoip.country' | 'any'
        action: 'allow' | 'block'
        value?: string[]
    }>
}

export interface UploadProgress {
    uid: string
    uploaded: boolean
    progress: number
    status: ProcessingStatus
    error?: string
}

export interface WebhookPayload {
    uid: string
    readyToStream: boolean
    status: {
        state: string
        pctComplete: string
        errorReasonCode?: string
        errorReasonText?: string
    }
    meta: Record<string, unknown>
    created: string
    modified: string
    size?: number
    duration?: number
    input?: {
        width: number
        height: number
    }
}

// Custom Error Classes
export class CloudflareStreamError extends Error {
    constructor(
        message: string,
        public code?: number,
        public details?: unknown
    ) {
        super(message)
        this.name = 'CloudflareStreamError'
    }
}

export class CloudflareStreamUploadError extends CloudflareStreamError {
    constructor(message: string, public uploadId?: string, details?: unknown) {
        super(message, undefined, details)
        this.name = 'CloudflareStreamUploadError'
    }
}

// Stream video ID validation: 32 lowercase hex characters
const STREAM_VIDEO_ID_PATTERN = /^[a-f0-9]{32}$/

export function isValidStreamVideoId(videoId: string): boolean {
    return STREAM_VIDEO_ID_PATTERN.test(videoId)
}

export function validateStreamVideoId(videoId: string): void {
    if (!isValidStreamVideoId(videoId)) {
        throw new CloudflareStreamError(
            'Invalid video ID format',
            400,
            { videoId }
        )
    }
}

// API Base Configuration (server-side only)
const getStreamApiBase = () => {
    if (typeof window !== 'undefined') {
        throw new Error('Cloudflare Stream API can only be used on server-side')
    }
    return `https://api.cloudflare.com/client/v4/accounts/${getStreamEnv().accountId}/stream`
}

const getStreamDirectUploadApi = () => {
    if (typeof window !== 'undefined') {
        throw new Error('Cloudflare Stream API can only be used on server-side')
    }
    return `https://api.cloudflare.com/client/v4/accounts/${getStreamEnv().accountId}/stream/direct_upload`
}

const getStreamHeaders = () => {
    if (typeof window !== 'undefined') {
        throw new Error('Cloudflare Stream API can only be used on server-side')
    }
    return {
        'Authorization': `Bearer ${getStreamEnv().apiToken}`,
        'Content-Type': 'application/json'
    }
}

// Helper Functions
async function handleStreamResponse<T>(response: Response): Promise<T> {
    const data = await response.json()

    if (!response.ok) {
        const errorMessage = data.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new CloudflareStreamError(
            errorMessage,
            response.status,
            data.errors
        )
    }

    if (!data.success) {
        const errorMessage = data.errors?.[0]?.message || 'Unknown Cloudflare Stream error'
        throw new CloudflareStreamError(
            errorMessage,
            data.errors?.[0]?.code,
            data.errors
        )
    }

    return data as T
}

function mapStreamStatusToProcessingStatus(streamState: string): ProcessingStatus {
    switch (streamState) {
        case 'pendingupload':
        case 'downloading':
            return 'uploading'
        case 'queued':
        case 'inprogress':
            return 'processing'
        case 'ready':
            return 'ready'
        case 'error':
            return 'error'
        default:
            return 'processing'
    }
}

// Upload Functions
export const uploadFunctions = {
    /**
     * Get direct upload URL from Cloudflare Stream
     */
    async getUploadUrl(options: {
        maxDurationSeconds?: number
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
        const payload: Record<string, unknown> = {
            maxDurationSeconds: options.maxDurationSeconds || 3600,
            requireSignedURLs: true
        }

        if (options.thumbnailTimestampPct !== undefined) {
            payload.thumbnailTimestampPct = options.thumbnailTimestampPct
        }

        if (options.creator) {
            payload.creator = options.creator
        }

        if (options.expiry) {
            payload.expiry = options.expiry
        }

        if (options.scheduledDeletion) {
            payload.scheduledDeletion = options.scheduledDeletion
        }

        // Only add allowedOrigins if it's not empty
        if (options.allowedOrigins && options.allowedOrigins.length > 0) {
            payload.allowedOrigins = options.allowedOrigins
        }

        // Only add meta if it has properties, and ensure all values are strings
        if (options.metadata && Object.keys(options.metadata).length > 0) {
            const cleanMeta: Record<string, string> = {}
            // Only include name field for Stream API meta
            Object.entries(options.metadata).forEach(([key, value]) => {
                if (key === 'name' && value !== null && value !== undefined && value !== '') {
                    cleanMeta[key] = String(value)
                }
            })
            if (Object.keys(cleanMeta).length > 0) {
                payload.meta = cleanMeta
            }
        }

        try {
            const response = await fetch(getStreamDirectUploadApi(), {
                method: 'POST',
                headers: getStreamHeaders(),
                body: JSON.stringify(payload)
            })

            const data = await handleStreamResponse<StreamUploadResponse>(response)

            return {
                uploadUrl: data.result.uploadURL,
                videoId: data.result.uid
            }
        } catch (error) {
            throw new CloudflareStreamUploadError(
                `Failed to get upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Upload video file to Cloudflare Stream
     */
    async uploadVideo(
        file: File | Blob,
        uploadUrl: string,
        onProgress?: (progress: number) => void
    ): Promise<void> {
        const formData = new FormData()
        formData.append('file', file)

        try {
            const xhr = new XMLHttpRequest()

            return new Promise((resolve, reject) => {
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
                        reject(new CloudflareStreamUploadError(
                            `Upload failed with status ${xhr.status}`,
                            undefined,
                            xhr.responseText
                        ))
                    }
                }

                xhr.onerror = () => {
                    reject(new CloudflareStreamUploadError(
                        'Network error during upload',
                        undefined,
                        xhr.statusText
                    ))
                }

                xhr.open('POST', uploadUrl)
                xhr.send(formData)
            })
        } catch (error) {
            throw new CloudflareStreamUploadError(
                `Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Check upload and processing status
     */
    async checkUploadStatus(videoId: string): Promise<UploadProgress> {
        validateStreamVideoId(videoId)
        try {
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                headers: getStreamHeaders()
            })

            const data = await handleStreamResponse<{ result: StreamVideoMetadata }>(response)
            const video = data.result

            const result = {
                uid: video.uid,
                uploaded: video.status.state !== 'pendingupload',
                progress: parseInt(video.status.pctComplete) || 0,
                status: mapStreamStatusToProcessingStatus(video.status.state),
                error: video.status.errorReasonText
            }

            return result
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to check upload status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    }
}

/** JWT replaces the video id. https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/ */
function signedStreamResourceUrl(
    host: string,
    token: string,
    resource: 'hls' | 'mp4' | 'thumbnail',
    query = ''
): string {
    if (resource === 'mp4') {
        return `https://${host}/${token}/downloads/default.mp4`
    }
    if (resource === 'thumbnail') {
        const path = `https://${host}/${token}/thumbnails/thumbnail.jpg`
        return query ? `${path}?${query}` : path
    }
    return `https://${host}/${token}/manifest/video.m3u8`
}

/** Admin iframe. The token stands where the bare video id used to. */
function signedIframeUrl(token: string): string {
    return `https://iframe.videodelivery.net/${token}`
}

function assertStreamSigningKeys(videoId: string): void {
    const hasSigningKeys = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID && process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    if (!hasSigningKeys) {
        throw new CloudflareStreamError(
            'Video signing keys not configured. Contact support.',
            503,
            { videoId, reason: 'MISSING_SIGNING_KEYS' }
        )
    }
}

async function requestStreamToken(
    videoId: string,
    payload: {
        exp: number
        nbf: number
        downloadable: boolean
        accessRules: NonNullable<SignedUrlOptions['accessRules']>
    }
): Promise<string> {
    const response = await fetch(`${getStreamApiBase()}/${videoId}/token`, {
        method: 'POST',
        headers: getStreamHeaders(),
        body: JSON.stringify({
            sub: videoId,
            kid: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,
            exp: payload.exp,
            nbf: payload.nbf,
            downloadable: payload.downloadable,
            accessRules: payload.accessRules,
        }),
    })

    const data = await handleStreamResponse<{ result: { token: string } }>(response)
    const token = data.result.token
    if (!token) {
        throw new CloudflareStreamError('Cloudflare Stream did not return a signing token')
    }
    return token
}

// Video Management Functions
export const videoManagement = {
    /**
     * Get video details from Cloudflare Stream
     */
    async getVideoDetails(videoId: string): Promise<StreamVideoMetadata> {
        validateStreamVideoId(videoId)
        try {
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                headers: getStreamHeaders()
            })

            const data = await handleStreamResponse<{ result: StreamVideoMetadata }>(response)
            return data.result
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to get video details: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Update video settings (e.g., requireSignedURLs)
     */
    async updateVideoSettings(videoId: string, settings: { requireSignedURLs?: boolean }): Promise<void> {
        validateStreamVideoId(videoId)
        try {
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                method: 'POST',
                headers: getStreamHeaders(),
                body: JSON.stringify(settings)
            })

            const data = await handleStreamResponse<{ result: StreamVideoMetadata }>(response)
            if (settings.requireSignedURLs && data.result?.requireSignedURLs !== true) {
                throw new CloudflareStreamError('Video still allows unsigned playback', 503)
            }
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to update video settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Generate signed URL for video access.
     * The JWT replaces the video id in the path.
     */
    async generateSignedUrl(
        videoId: string,
        subscriptionTier: SubscriptionTier,
        options: SignedUrlOptions = {},
        format: 'hls' | 'mp4' = 'hls'
    ): Promise<string> {
        validateStreamVideoId(videoId)
        assertStreamSigningKeys(videoId)
        await this.updateVideoSettings(videoId, { requireSignedURLs: true })

        const now = Math.floor(Date.now() / 1000)
        let expiration = now + (24 * 60 * 60) // 24 hours default

        switch (subscriptionTier) {
            case 'none':
                expiration = now + (30 * 60) // 30 minutes for free content
                break
            case 'tier1':
                expiration = now + (2 * 60 * 60) // 2 hours
                break
            case 'tier2':
                expiration = now + (8 * 60 * 60) // 8 hours
                break
            case 'tier3':
                expiration = now + (24 * 60 * 60) // 24 hours
                break
        }

        try {
            const token = await requestStreamToken(videoId, {
                exp: options.exp || expiration,
                nbf: options.nbf || now,
                downloadable: options.downloadable || false,
                accessRules: options.accessRules || [],
            })
            const host = getStreamEnv().customerSubdomain
            if (format === 'mp4') {
                return signedStreamResourceUrl(host, token, 'mp4')
            }
            return signedStreamResourceUrl(host, token, 'hls')
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Signed thumbnail for an admin. The JWT replaces the video id.
     * Do not store the result: it expires, and it is a bearer token.
     */
    async generateThumbnailUrl(
        videoId: string,
        options: {
            time?: number // Time in seconds
            width?: number
            height?: number
            fit?: 'clip' | 'crop' | 'pad' | 'scale-down'
        } = {},
        expiresAt?: number
    ): Promise<string> {
        validateStreamVideoId(videoId)
        assertStreamSigningKeys(videoId)
        await this.updateVideoSettings(videoId, { requireSignedURLs: true })

        const params = new URLSearchParams()
        if (options.time) params.set('time', options.time.toString())
        if (options.width) params.set('width', options.width.toString())
        if (options.height) params.set('height', options.height.toString())
        if (options.fit) params.set('fit', options.fit)

        const now = Math.floor(Date.now() / 1000)
        const token = await requestStreamToken(videoId, {
            exp: expiresAt ?? now + (60 * 60),
            nbf: now,
            downloadable: false,
            accessRules: [],
        })
        return signedStreamResourceUrl(
            getStreamEnv().customerSubdomain,
            token,
            'thumbnail',
            params.toString()
        )
    },

    /**
     * Signed admin iframe. The JWT replaces the video id.
     */
    async generateSignedIframeUrl(videoId: string): Promise<string> {
        validateStreamVideoId(videoId)
        assertStreamSigningKeys(videoId)
        await this.updateVideoSettings(videoId, { requireSignedURLs: true })
        const now = Math.floor(Date.now() / 1000)
        const token = await requestStreamToken(videoId, {
            exp: now + (60 * 60),
            nbf: now,
            downloadable: false,
            accessRules: [],
        })
        return signedIframeUrl(token)
    },

    /**
     * Retry processing for a failed video
     */
    async retryProcessing(videoId: string): Promise<void> {
        validateStreamVideoId(videoId)
        try {
            // First, get current video details to check status
            const videoDetails = await videoManagement.getVideoDetails(videoId)

            if (videoDetails.status.state === 'ready') {
                throw new CloudflareStreamError('Video is already processed successfully')
            }

            // For Cloudflare Stream, retrying usually means re-triggering processing
            // This can be done by updating the video metadata or re-uploading
            // Since we can't directly retry processing via API, we'll update metadata to trigger a refresh
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                method: 'POST',
                headers: getStreamHeaders(),
                body: JSON.stringify({
                    meta: {
                        ...videoDetails.meta,
                        retry_timestamp: new Date().toISOString()
                    }
                })
            })

            await handleStreamResponse(response)

            // If the above doesn't work, we might need to delete and re-upload
            // For now, we'll just mark it as queued in our database
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to retry processing for video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Delete video from Cloudflare Stream
     */
    async deleteVideo(videoId: string): Promise<void> {
        validateStreamVideoId(videoId)
        try {
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                method: 'DELETE',
                headers: getStreamHeaders()
            })

            await handleStreamResponse<{ result: null }>(response)
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Update video metadata
     */
    async updateVideoMetadata(
        videoId: string,
        metadata: {
            name?: string
            requireSignedURLs?: boolean
            allowedOrigins?: string[]
            thumbnailTimestampPct?: number
        }
    ): Promise<StreamVideoMetadata> {
        validateStreamVideoId(videoId)
        try {
            const response = await fetch(`${getStreamApiBase()}/${videoId}`, {
                method: 'POST',
                headers: getStreamHeaders(),
                body: JSON.stringify({
                    meta: metadata.name ? { name: metadata.name } : undefined,
                    requireSignedURLs: metadata.requireSignedURLs,
                    allowedOrigins: metadata.allowedOrigins,
                    thumbnailTimestampPct: metadata.thumbnailTimestampPct
                })
            })

            const data = await handleStreamResponse<{ result: StreamVideoMetadata }>(response)
            return data.result
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to update video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    }
}

// Webhook Handling Functions
export const webhookHandling = {
    /**
     * Process webhook payload from Cloudflare Stream
     */
    async processWebhook(payload: WebhookPayload): Promise<void> {
        try {
            // Validate webhook payload
            if (!payload.uid) {
                throw new Error('Invalid webhook payload: missing uid')
            }

            // Update video status in database
            await webhookHandling.updateVideoStatus(payload.uid, payload)

            // Handle processing complete
            if (payload.readyToStream && payload.status.state === 'ready') {
                await webhookHandling.handleProcessingComplete(payload.uid, payload)
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                 
                console.error('Webhook processing error:', error)
            }
            throw new CloudflareStreamError(
                `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Update video status in database
     */
    async updateVideoStatus(videoId: string, payload: WebhookPayload): Promise<void> {
        const supabase = createAdminClient()

        try {
            const processingStatus = mapStreamStatusToProcessingStatus(payload.status.state)

            const updates: VideoUpdate = {
                processing_status: processingStatus,
                updated_at: new Date().toISOString()
            }

            // Add duration if available
            if (payload.duration) {
                updates.duration_seconds = Math.round(payload.duration)
            }

            const { error } = await supabase
                .from('videos')
                .update(updates)
                .eq('cloudflare_video_id', videoId)

            if (error) {
                throw handleSupabaseError(error)
            }
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to update video status in database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Handle processing complete event
     */
    async handleProcessingComplete(videoId: string, payload: WebhookPayload): Promise<void> {
        const supabase = createAdminClient()

        try {
            // Get video from database
            const { data: video, error: fetchError } = await supabase
                .from('videos')
                .select('*')
                .eq('cloudflare_video_id', videoId)
                .single()

            if (fetchError) {
                throw handleSupabaseError(fetchError)
            }

            if (!video) {
                if (process.env.NODE_ENV === 'development') {
                     
                    console.warn(`Video with cloudflare_video_id ${videoId} not found in database`)
                }
                return
            }

            // Update final metadata
            const updates: VideoUpdate = {
                processing_status: 'ready',
                is_published: false, // Keep unpublished until admin approval
                duration_seconds: payload.duration ? Math.round(payload.duration) : video.duration_seconds,
                updated_at: new Date().toISOString()
            }

            const { error: updateError } = await supabase
                .from('videos')
                .update(updates)
                .eq('id', video.id)

            if (updateError) {
                throw handleSupabaseError(updateError)
            }

            // TODO: Send notification to admin about completed processing
            if (process.env.NODE_ENV === 'development') {
                 
                console.log(`Video processing completed for ${video.title} (${videoId})`)
            }
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to handle processing complete: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    }
}

// Security Functions
export const securityFunctions = {
    /**
     * Generate admin preview URL (no subscription restrictions)
     */
    async generateAdminPreviewUrl(videoId: string, format: 'hls' | 'iframe' = 'hls'): Promise<string> {
        if (format === 'iframe') {
            return videoManagement.generateSignedIframeUrl(videoId)
        }
        return videoManagement.generateSignedUrl(videoId, 'tier3', {
            exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
            downloadable: false
        })
    },

    /**
     * Check if user has access to video based on subscription
     */
    async validateVideoAccess(
        userSubscriptionTier: SubscriptionTier | null,
        requiredTier: SubscriptionTier
    ): Promise<boolean> {
        if (!userSubscriptionTier) {
            return false
        }

        const tierHierarchy: Record<SubscriptionTier, number> = {
            none: 0,
            tier1: 1,
            tier2: 2,
            tier3: 3
        }

        return tierHierarchy[userSubscriptionTier] >= tierHierarchy[requiredTier]
    }
}

// Export service object for easy importing
export const cloudflareStreamService = {
    upload: uploadFunctions,
    video: videoManagement,
    webhook: webhookHandling,
    security: securityFunctions
}

export default cloudflareStreamService 
