/**
 * Cloudflare Stream Webhook Handler
 * Handles video processing notifications from Cloudflare Stream
 */

import { createAdminClient } from '@/src/lib/supabase'
import { json } from '@/src/lib/http'
import { isValidStreamVideoId } from '@/src/services/cloudflare-stream'

// Cloudflare Stream webhook payload is the video object itself
// See: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
interface CloudflareStreamWebhookPayload {
    uid: string
    readyToStream: boolean
    status: {
        state: 'queued' | 'inprogress' | 'ready' | 'error' | 'downloading' | 'pendingupload'
        pctComplete?: string
        errorReasonCode?: string
        errorReasonText?: string
    }
    meta?: Record<string, unknown>
    playback?: {
        hls?: string
        dash?: string
    }
    preview?: string
    thumbnail?: string
    duration?: number
    input?: {
        width?: number
        height?: number
    }
    created?: string
    modified?: string
    size?: number
}

// Database update retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
}

// Maximum age for webhook requests (5 minutes)
const MAX_TIMESTAMP_AGE_SECONDS = 300

// Constant-time comparison for both Node.js and Cloudflare Workers.
function timingSafeEqual(expected: Uint8Array, received: Uint8Array): boolean {
    const lengthsMatch = expected.byteLength === received.byteLength
    const compareTarget = lengthsMatch ? received : expected
    let diff = 0
    for (let i = 0; i < expected.byteLength; i++) {
        diff |= expected[i] ^ compareTarget[i]
    }
    return lengthsMatch && diff === 0
}

// Webhook signature verification per Cloudflare Stream docs
// Header format: Webhook-Signature: time=<unix_ts>,sig1=<hex_signature>
// Signature source: "<time>.<body>"
async function verifyWebhookSignature(
    payload: string,
    signatureHeader: string | null,
    secret: string
): Promise<boolean> {
    if (!signatureHeader || !secret) {
        return false
    }

    try {
        // Parse "time=<unix_ts>,sig1=<hex_signature>"
        const parts = Object.fromEntries(
            signatureHeader.split(',').map(part => {
                const [key, value] = part.split('=')
                return [key, value]
            })
        )

        const time = parts['time']
        const receivedSig = parts['sig1']

        if (!time || !receivedSig) {
            return false
        }

        // Validate timestamp (two-sided: reject old AND future requests)
        const timestamp = parseInt(time, 10)
        if (isNaN(timestamp)) {
            return false
        }
        const now = Math.floor(Date.now() / 1000)
        const diff = now - timestamp
        if (diff > MAX_TIMESTAMP_AGE_SECONDS || diff < -MAX_TIMESTAMP_AGE_SECONDS) {
            return false
        }

        // Build source string: "<time>.<body>"
        const sourceString = `${time}.${payload}`
        const encoder = new TextEncoder()

        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )

        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(sourceString)
        )

        const expectedSig = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        // Use timing-safe comparison
        const expectedBytes = encoder.encode(expectedSig)
        const receivedBytes = encoder.encode(receivedSig)

        return timingSafeEqual(expectedBytes, receivedBytes)
    } catch {
        return false
    }
}

// Retry logic for database operations
async function withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount = 0
): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        if (retryCount >= RETRY_CONFIG.maxRetries) {
            console.error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} retries:`, error)
            throw error
        }

        const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
            RETRY_CONFIG.maxDelay
        )

        console.warn(`${operationName} failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries}):`, error)

        await new Promise(resolve => setTimeout(resolve, delay))
        return withRetry(operation, operationName, retryCount + 1)
    }
}

// Known states that we handle - unknown states are a no-op
const KNOWN_STATES = new Set(['ready', 'inprogress', 'error', 'queued', 'downloading', 'pendingupload'])

// Derive DB status from webhook payload
// Returns null for unknown states (no-op)
function deriveStatusFromPayload(payload: CloudflareStreamWebhookPayload): {
    processingStatus: string
    isPublished: boolean
    metadata: Record<string, unknown>
} | null {
    const state = payload.status?.state
    
    // Unknown state is a no-op
    if (!state || !KNOWN_STATES.has(state)) {
        return null
    }

    const metadata: Record<string, unknown> = {}

    // Derive status based on state and readyToStream
    if (state === 'ready' && payload.readyToStream) {
        // Extract video metadata for ready state
        if (payload.duration) {
            metadata.duration = Math.round(payload.duration)
        }
        if (payload.input?.width && payload.input?.height) {
            metadata.resolution = `${payload.input.width}x${payload.input.height}`
        }
        if (payload.playback?.hls) {
            metadata.hls_url = payload.playback.hls
        }
        if (payload.playback?.dash) {
            metadata.dash_url = payload.playback.dash
        }
        if (payload.thumbnail) {
            metadata.thumbnail_url = payload.thumbnail
        }
        if (payload.preview) {
            metadata.preview_url = payload.preview
        }
        if (payload.size) {
            metadata.file_size = payload.size
        }
        return { processingStatus: 'ready', isPublished: true, metadata }
    }

    if (state === 'error') {
        metadata.error_code = payload.status?.errorReasonCode
        metadata.error_message = payload.status?.errorReasonText
        return { processingStatus: 'error', isPublished: false, metadata }
    }

    if (state === 'inprogress' || state === 'queued' || state === 'downloading' || state === 'pendingupload') {
        return { processingStatus: 'processing', isPublished: false, metadata }
    }

    // Ready but not readyToStream yet - still processing
    if (state === 'ready' && !payload.readyToStream) {
        return { processingStatus: 'processing', isPublished: false, metadata }
    }

    return null
}

// Update video status in Supabase
// Returns false if no update was made (unknown state)
async function updateVideoStatus(
    videoUid: string,
    payload: CloudflareStreamWebhookPayload
): Promise<boolean> {
    const derived = deriveStatusFromPayload(payload)
    
    // Unknown state is a no-op
    if (!derived) {
        return false
    }

    const supabase = createAdminClient()

    // Find video by Cloudflare UID
    const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('id, title, cloudflare_video_id')
        .eq('cloudflare_video_id', videoUid)
        .single()

    if (fetchError || !video) {
        throw new Error(`Video with UID ${videoUid} not found in database: ${fetchError?.message}`)
    }

    // Build update data
    const updateData: Record<string, unknown> = {
        processing_status: derived.processingStatus,
        is_published: derived.isPublished,
        updated_at: new Date().toISOString()
    }

    // Add metadata fields if they exist
    const { metadata } = derived
    if (metadata.duration) updateData.duration_seconds = metadata.duration
    if (metadata.resolution) updateData.resolution = metadata.resolution
    if (metadata.hls_url) updateData.hls_url = metadata.hls_url
    if (metadata.dash_url) updateData.dash_url = metadata.dash_url
    if (metadata.thumbnail_url) updateData.thumbnail_url = metadata.thumbnail_url
    if (metadata.preview_url) updateData.preview_url = metadata.preview_url
    if (metadata.file_size) updateData.file_size = metadata.file_size
    if (metadata.error_code) updateData.error_code = metadata.error_code
    if (metadata.error_message) updateData.error_message = metadata.error_message

    const { error: updateError } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', video.id)

    if (updateError) {
        throw new Error(`Failed to update video ${video.id}: ${updateError.message}`)
    }

    return true
}

// Send admin notifications for important events
async function sendAdminNotification(
    payload: CloudflareStreamWebhookPayload
): Promise<void> {
    const supabase = createAdminClient()
    const state = payload.status?.state

    // Only send notifications for ready and error states
    if (state !== 'ready' && state !== 'error') {
        return
    }

    // For ready state, only notify if readyToStream is true
    if (state === 'ready' && !payload.readyToStream) {
        return
    }

    const isError = state === 'error'
    const notificationTitle = isError
        ? 'Video Processing Failed'
        : 'Video Processing Complete'

    const notificationMessage = isError
        ? `Video "${payload.uid}" failed to process: ${payload.status?.errorReasonText || 'Unknown error'}`
        : `Video "${payload.uid}" is now ready for viewing`

    // Get admin users to notify
    const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, email, admin_role')
        .in('admin_role', ['super_admin', 'content_admin'])

    if (adminsError) {
        console.error('Failed to fetch admin users for notification:', adminsError)
        return
    }

    // Create notification records
    const notifications = admins?.map((admin: { id: string; email: string; admin_role: string }) => ({
        user_id: admin.id,
        title: notificationTitle,
        message: notificationMessage,
        type: isError ? 'error' : 'success',
        category: 'video_processing',
        metadata: {
            video_uid: payload.uid,
            state: state,
            timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
    })) || []

    if (notifications.length > 0) {
        const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notifications)

        if (notificationError) {
            console.error('Failed to create admin notifications:', notificationError)
        }
    }

    // Also log to system for monitoring
    const { error: logError } = await supabase
        .from('system_logs')
        .insert({
            level: isError ? 'error' : 'info',
            category: 'video_processing',
            message: notificationMessage,
            metadata: {
                video_uid: payload.uid,
                state: state
            },
            created_at: new Date().toISOString()
        })

    if (logError) {
        console.error('Failed to create system log:', logError)
    }
}

// Log webhook events for debugging and monitoring
async function logWebhookEvent(
    payload: CloudflareStreamWebhookPayload,
    success: boolean,
    error?: string
): Promise<void> {
    const supabase = createAdminClient()

    const logEntry = {
        webhook_source: 'cloudflare_stream',
        video_uid: payload.uid,
        state: payload.status?.state,
        success,
        error_message: error,
        event_data: payload,
        timestamp: new Date().toISOString()
    }

    try {
        const { error: logError } = await supabase
            .from('webhook_logs')
            .insert(logEntry)

        if (logError) {
            console.error('Failed to log webhook event:', logError)
        }
    } catch (err) {
        console.error('Error logging webhook event:', err)
    }
}

// Main webhook handler
export async function POST({ request }: { request: Request }) {
    let webhookPayload: string
    let payload: CloudflareStreamWebhookPayload

    try {
        // Get webhook payload
        webhookPayload = await request.text()

        if (!webhookPayload) {
            return json(
                { error: 'Empty payload' },
                { status: 400 }
            )
        }

        // Verify webhook signature
        const signature = request.headers.get('Webhook-Signature')
        const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET

        if (!webhookSecret) {
            return json(
                { error: 'Webhook not configured' },
                { status: 503 }
            )
        }

        const isValidSignature = await verifyWebhookSignature(
            webhookPayload,
            signature,
            webhookSecret
        )

        if (!isValidSignature) {
            return json(
                { error: 'Invalid signature' },
                { status: 401 }
            )
        }

        // Parse JSON
        try {
            payload = JSON.parse(webhookPayload)
        } catch {
            return json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            )
        }

        // Validate uid format before any DB lookup
        if (!payload.uid || !isValidStreamVideoId(payload.uid)) {
            return json(
                { error: 'Invalid video ID format' },
                { status: 400 }
            )
        }

        // Process the webhook event with retry logic
        const updated = await withRetry(
            async () => {
                // Update video status in database (returns false for unknown states)
                const didUpdate = await updateVideoStatus(payload.uid, payload)

                // Send admin notifications for important events
                if (didUpdate) {
                    await sendAdminNotification(payload)
                }

                return didUpdate
            },
            `Webhook processing for ${payload.status?.state}`,
            0
        )

        // Log successful webhook processing
        await logWebhookEvent(payload, true)

        return json(
            {
                success: true,
                videoUid: payload.uid,
                state: payload.status?.state,
                updated
            },
            { status: 200 }
        )

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Log failed webhook processing
        if (payload!) {
            await logWebhookEvent(payload, false, errorMessage)
        }

        return json(
            {
                error: 'Webhook processing failed',
                message: errorMessage
            },
            { status: 500 }
        )
    }
}

// Handle other HTTP methods
export async function GET() {
    return json(
        { message: 'Cloudflare Stream webhook endpoint' },
        { status: 200 }
    )
}

export async function PUT() {
    return json(
        { error: 'Method not allowed' },
        { status: 405 }
    )
}

export async function DELETE() {
    return json(
        { error: 'Method not allowed' },
        { status: 405 }
    )
} 