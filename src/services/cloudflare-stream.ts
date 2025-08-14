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

// Environment variables validation (server-side only)
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const CLOUDFLARE_CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN || 'customer-235te0s698xfdejs'

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Missing Cloudflare environment variables')
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

// API Base Configuration
const STREAM_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`
const STREAM_DIRECT_UPLOAD_API = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`

const streamHeaders = {
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
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
        const payload: Record<string, any> = {
            maxDurationSeconds: options.maxDurationSeconds || 3600 // 1 hour default, required field
        }

        // Only add other fields if specified

        if (options.requireSignedURLs !== undefined) {
            payload.requireSignedURLs = options.requireSignedURLs
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
            console.log('DEBUG: Raw options passed to getUploadUrl:', JSON.stringify(options, null, 2))
            console.log('DEBUG: Constructed payload before stringification:', JSON.stringify(payload, null, 2))
            console.log('DEBUG: Stringified payload:', JSON.stringify(payload))

            console.log('Cloudflare Stream API Request:', {
                url: STREAM_DIRECT_UPLOAD_API,
                headers: streamHeaders,
                payload: payload
            })

            const response = await fetch(STREAM_DIRECT_UPLOAD_API, {
                method: 'POST',
                headers: streamHeaders,
                body: JSON.stringify(payload)
            })

            console.log('Cloudflare Stream API Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            })

            const responseText = await response.text()
            console.log('Cloudflare Stream API Response Body:', responseText)

            let data
            try {
                data = JSON.parse(responseText)
            } catch (parseError) {
                throw new CloudflareStreamError(
                    `Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                    response.status,
                    responseText
                )
            }

            if (!response.ok) {
                const errorMessage = data.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`
                console.log('Cloudflare Stream API Error Details:', data.errors)
                throw new CloudflareStreamError(
                    errorMessage,
                    response.status,
                    data.errors
                )
            }

            if (!data.success) {
                const errorMessage = data.errors?.[0]?.message || 'Unknown Cloudflare Stream error'
                console.log('Cloudflare Stream API Error Details:', data.errors)
                throw new CloudflareStreamError(
                    errorMessage,
                    data.errors?.[0]?.code,
                    data.errors
                )
            }

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
        try {
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                headers: streamHeaders
            })

            const data = await handleStreamResponse<{ result: StreamVideoMetadata }>(response)
            const video = data.result

            return {
                uid: video.uid,
                uploaded: video.status.state !== 'pendingupload',
                progress: parseInt(video.status.pctComplete) || 0,
                status: mapStreamStatusToProcessingStatus(video.status.state),
                error: video.status.errorReasonText
            }
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to check upload status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    }
}

// Video Management Functions
export const videoManagement = {
    /**
     * Get video details from Cloudflare Stream
     */
    async getVideoDetails(videoId: string): Promise<StreamVideoMetadata> {
        try {
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                headers: streamHeaders
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
        try {
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                method: 'POST',
                headers: streamHeaders,
                body: JSON.stringify(settings)
            })

            await handleStreamResponse(response)
        } catch (error) {
            throw new CloudflareStreamError(
                `Failed to update video settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error
            )
        }
    },

    /**
     * Generate signed URL for video access
     */
    async generateSignedUrl(
        videoId: string,
        subscriptionTier: SubscriptionTier,
        options: SignedUrlOptions = {},
        format: 'hls' | 'mp4' = 'hls'
    ): Promise<string> {
        // Check if we have signing keys configured for secure JWT generation
        const hasSigningKeys = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID && process.env.CLOUDFLARE_STREAM_SIGNING_KEY;

        if (!hasSigningKeys) {
            console.warn('🔐 Missing Cloudflare Stream signing keys - using temporary public access for development');
            console.warn('🔐 ⚠️  SECURITY WARNING: Videos will be publicly accessible without authentication');
            console.warn('🔐 To secure videos, configure CLOUDFLARE_STREAM_SIGNING_KEY_ID and CLOUDFLARE_STREAM_SIGNING_KEY');

            // Temporarily use public URLs for development (with warning)
            try {
                await this.updateVideoSettings(videoId, { requireSignedURLs: false });
                const publicUrl = format === 'mp4'
                    ? `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/downloads/default.mp4`
                    : `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/manifest/video.m3u8`;

                console.log('🔐 Returning public URL (DEVELOPMENT ONLY):', publicUrl);
                return publicUrl;
            } catch (settingsError) {
                console.error('🔐 Could not configure video for public access:', settingsError);
                throw new CloudflareStreamError('Video access configuration failed', undefined, settingsError);
            }
        }

        // Configure video to require signed URLs for security
        try {
            await this.updateVideoSettings(videoId, { requireSignedURLs: true });
            console.log('🔐 Video configured to require signed URLs (secure mode)');
        } catch (error) {
            console.warn('🔐 Could not configure video settings:', error);
        }

        // Set expiration based on subscription tier
        const now = Math.floor(Date.now() / 1000)
        let expiration = now + (24 * 60 * 60) // 24 hours default

        switch (subscriptionTier) {
            case 'beginner':
                expiration = now + (2 * 60 * 60) // 2 hours
                break
            case 'intermediate':
                expiration = now + (8 * 60 * 60) // 8 hours
                break
            case 'advanced':
                expiration = now + (24 * 60 * 60) // 24 hours
                break
        }

        // Use proper JWT signing with RSA keys when available
        if (hasSigningKeys) {
            const payload = {
                sub: videoId, // Video ID
                kid: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID!, // Key ID
                exp: options.exp || expiration,
                nbf: options.nbf || now,
                downloadable: options.downloadable || false,
                accessRules: options.accessRules || []
            }

            console.log('🔐 Generating secure JWT token with RSA signing:', {
                videoId,
                keyId: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,
                expiration: new Date(expiration * 1000).toISOString()
            });

            // TODO: Implement proper RSA JWT signing here
            // For now, we'll use Cloudflare's token generation API as fallback
            // In production, you should use a JWT library like 'jsonwebtoken' with RSA signing

            try {
                const response = await fetch(`${STREAM_API_BASE}/${videoId}/token`, {
                    method: 'POST',
                    headers: streamHeaders,
                    body: JSON.stringify(payload)
                })

                console.log('🔐 Token response status:', response.status);
                const data = await handleStreamResponse<{ result: { token: string } }>(response)

                console.log('🔐 Token generated successfully:', {
                    hasToken: !!data.result.token,
                    tokenLength: data.result.token?.length,
                    tokenPreview: data.result.token?.substring(0, 50) + '...'
                });

                // Construct the signed URL based on requested format using customer subdomain
                if (format === 'mp4') {
                    // MP4 download format for better mobile compatibility
                    // Format: https://customer-subdomain.cloudflarestream.com/video-id/downloads/default.mp4?token=signed-token
                    return `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/downloads/default.mp4?token=${data.result.token}`
                } else {
                    // HLS streaming format (default)
                    // Format: https://customer-subdomain.cloudflarestream.com/video-id/manifest/video.m3u8?token=signed-token
                    return `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/manifest/video.m3u8?token=${data.result.token}`
                }
            } catch (error) {
                throw new CloudflareStreamError(
                    `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    undefined,
                    error
                )
            }
        }

        // Fallback: should never reach here
        throw new CloudflareStreamError('Unable to generate video URL - configuration error');
    },

    /**
     * Get video thumbnail URL
     */
    async generateThumbnailUrl(
        videoId: string,
        options: {
            time?: number // Time in seconds
            width?: number
            height?: number
            fit?: 'clip' | 'crop' | 'pad' | 'scale-down'
        } = {}
    ): Promise<string> {
        const params = new URLSearchParams()

        if (options.time) params.set('time', options.time.toString())
        if (options.width) params.set('width', options.width.toString())
        if (options.height) params.set('height', options.height.toString())
        if (options.fit) params.set('fit', options.fit)

        const queryString = params.toString()
        const baseUrl = `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/thumbnails/thumbnail.jpg`

        return queryString ? `${baseUrl}?${queryString}` : baseUrl
    },

    /**
     * Retry processing for a failed video
     */
    async retryProcessing(videoId: string): Promise<void> {
        try {
            // First, get current video details to check status
            const videoDetails = await videoManagement.getVideoDetails(videoId)

            if (videoDetails.status.state === 'ready') {
                throw new CloudflareStreamError('Video is already processed successfully')
            }

            // For Cloudflare Stream, retrying usually means re-triggering processing
            // This can be done by updating the video metadata or re-uploading
            // Since we can't directly retry processing via API, we'll update metadata to trigger a refresh
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                method: 'POST',
                headers: streamHeaders,
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
        try {
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                method: 'DELETE',
                headers: streamHeaders
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
        try {
            const response = await fetch(`${STREAM_API_BASE}/${videoId}`, {
                method: 'POST',
                headers: streamHeaders,
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
                // eslint-disable-next-line no-console
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

            // Generate thumbnail URL if video is ready
            if (payload.readyToStream) {
                updates.thumbnail_url = await videoManagement.generateThumbnailUrl(videoId)
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
                    // eslint-disable-next-line no-console
                    console.warn(`Video with cloudflare_video_id ${videoId} not found in database`)
                }
                return
            }

            // Update final metadata
            const updates: VideoUpdate = {
                processing_status: 'ready',
                is_published: false, // Keep unpublished until admin approval
                duration_seconds: payload.duration ? Math.round(payload.duration) : video.duration_seconds,
                thumbnail_url: await videoManagement.generateThumbnailUrl(videoId),
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
                // eslint-disable-next-line no-console
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
    async generateAdminPreviewUrl(videoId: string): Promise<string> {
        return videoManagement.generateSignedUrl(videoId, 'advanced', {
            exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
            downloadable: false
        })
    },

    /**
     * Validate webhook signature (implement based on Cloudflare webhook setup)
     */
    validateWebhookSignature(
        payload: string,
        signature: string,
        secret: string
    ): boolean {
        // TODO: Implement webhook signature validation
        // This would typically use HMAC-SHA256 to verify the webhook came from Cloudflare
        // For now, we'll just reference the parameters to avoid linting errors
        if (payload && signature && secret) {
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.warn('Webhook signature validation not implemented yet')
            }
        }
        return true
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
            beginner: 1,
            intermediate: 2,
            advanced: 3
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