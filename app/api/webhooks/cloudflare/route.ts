/**
 * Evolution Combatives - Cloudflare Stream Webhook Handler
 * Professional webhook endpoint for video processing events
 * Designed for tactical training content management
 * 
 * @description Handles all Cloudflare Stream webhook events with database updates and admin notifications
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createAdminClient } from '../../../../src/lib/supabase'

// Cloudflare Stream webhook event types
interface CloudflareStreamEvent {
    eventId: string
    eventTimestamp: string
    eventType: 'video.upload.complete' | 'video.processing.started' | 'video.processing.complete' | 'video.processing.failed' | 'video.ready' | 'video.deleted'
    uid: string // Video UID from Cloudflare
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
    status?: {
        state: 'queued' | 'inprogress' | 'ready' | 'error'
        pctComplete?: string
        errorReasonCode?: string
        errorReasonText?: string
    }
    created?: string
    modified?: string
    size?: number
    watermark?: Record<string, unknown>
    nft?: unknown
}

// Database update retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
}

// Webhook signature verification
function verifyWebhookSignature(
    payload: string,
    signature: string | null,
    secret: string
): boolean {
    if (!signature || !secret) {
        console.warn('Missing webhook signature or secret')
        return false
    }

    try {
        // Cloudflare Stream uses HMAC-SHA256
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex')

        // Compare signatures using constant-time comparison
        return crypto.timingSafeEqual(
            Buffer.from(signature.replace('sha256=', '')),
            Buffer.from(expectedSignature)
        )
    } catch (error) {
        console.error('Webhook signature verification failed:', error)
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

// Update video status in Supabase
async function updateVideoStatus(
    videoUid: string,
    event: CloudflareStreamEvent
): Promise<void> {
    const supabase = createAdminClient()

    // Find video by Cloudflare UID
    const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('id, title, cloudflare_stream_uid')
        .eq('cloudflare_stream_uid', videoUid)
        .single()

    if (fetchError || !video) {
        throw new Error(`Video with UID ${videoUid} not found in database: ${fetchError?.message}`)
    }

    // Determine processing status and video metadata
    let processingStatus: string
    let isPublished = false
    const metadata: Record<string, unknown> = {}

    switch (event.eventType) {
        case 'video.upload.complete':
            processingStatus = 'processing'
            break
        case 'video.processing.started':
            processingStatus = 'processing'
            break
        case 'video.processing.complete':
        case 'video.ready':
            processingStatus = 'ready'
            isPublished = true

            // Extract video metadata
            if (event.duration) {
                metadata.duration = Math.round(event.duration)
            }
            if (event.input?.width && event.input?.height) {
                metadata.resolution = `${event.input.width}x${event.input.height}`
            }
            if (event.playback?.hls) {
                metadata.hls_url = event.playback.hls
            }
            if (event.playback?.dash) {
                metadata.dash_url = event.playback.dash
            }
            if (event.thumbnail) {
                metadata.thumbnail_url = event.thumbnail
            }
            if (event.preview) {
                metadata.preview_url = event.preview
            }
            if (event.size) {
                metadata.file_size = event.size
            }
            break
        case 'video.processing.failed':
            processingStatus = 'error'
            metadata.error_code = event.status?.errorReasonCode
            metadata.error_message = event.status?.errorReasonText
            break
        case 'video.deleted':
            processingStatus = 'deleted'
            isPublished = false
            break
        default:
            processingStatus = 'queued'
    }

    // Update video in database
    const updateData: Record<string, unknown> = {
        processing_status: processingStatus,
        is_published: isPublished,
        updated_at: new Date().toISOString()
    }

    // Add metadata fields if they exist
    if (metadata.duration) updateData.duration = metadata.duration
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

    console.log(`Video ${video.title} (${video.id}) updated successfully:`, {
        eventType: event.eventType,
        processingStatus,
        metadata
    })
}

// Send admin notifications for important events
async function sendAdminNotification(
    event: CloudflareStreamEvent,
    videoTitle?: string
): Promise<void> {
    const supabase = createAdminClient()

    // Only send notifications for completion and error events
    if (!['video.ready', 'video.processing.failed'].includes(event.eventType)) {
        return
    }

    const isError = event.eventType === 'video.processing.failed'
    const notificationTitle = isError
        ? 'Video Processing Failed'
        : 'Video Processing Complete'

    const notificationMessage = isError
        ? `Video "${videoTitle || event.uid}" failed to process: ${event.status?.errorReasonText || 'Unknown error'}`
        : `Video "${videoTitle || event.uid}" is now ready for viewing`

    // Get admin users to notify
    const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, email, admin_role')
        .in('admin_role', ['super_admin', 'content_admin'])

    if (adminsError) {
        console.error('Failed to fetch admin users for notification:', adminsError)
        return
    }

    // Create notification records (assuming you have a notifications table)
    const notifications = admins?.map((admin: { id: string; email: string; admin_role: string }) => ({
        user_id: admin.id,
        title: notificationTitle,
        message: notificationMessage,
        type: isError ? 'error' : 'success',
        category: 'video_processing',
        metadata: {
            video_uid: event.uid,
            event_type: event.eventType,
            timestamp: event.eventTimestamp
        },
        created_at: new Date().toISOString()
    })) || []

    if (notifications.length > 0) {
        const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notifications)

        if (notificationError) {
            console.error('Failed to create admin notifications:', notificationError)
        } else {
            console.log(`Sent ${notifications.length} admin notifications for ${event.eventType}`)
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
                video_uid: event.uid,
                event_type: event.eventType,
                event_data: event
            },
            created_at: new Date().toISOString()
        })

    if (logError) {
        console.error('Failed to create system log:', logError)
    }
}

// Log webhook events for debugging and monitoring
async function logWebhookEvent(
    event: CloudflareStreamEvent,
    success: boolean,
    error?: string
): Promise<void> {
    const supabase = createAdminClient()

    const logEntry = {
        webhook_source: 'cloudflare_stream',
        event_id: event.eventId,
        event_type: event.eventType,
        video_uid: event.uid,
        success,
        error_message: error,
        event_data: event,
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
export async function POST(request: NextRequest) {
    let webhookPayload: string
    let event: CloudflareStreamEvent

    try {
        // Get webhook payload
        webhookPayload = await request.text()

        if (!webhookPayload) {
            console.error('Empty webhook payload received')
            return NextResponse.json(
                { error: 'Empty payload' },
                { status: 400 }
            )
        }

        // Parse JSON event
        try {
            event = JSON.parse(webhookPayload)
        } catch (parseError) {
            console.error('Invalid JSON payload:', parseError)
            return NextResponse.json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            )
        }

        // Verify webhook signature if secret is configured
        const headersList = await headers()
        const signature = headersList.get('x-signature')
        const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET

        if (webhookSecret) {
            const isValidSignature = verifyWebhookSignature(
                webhookPayload,
                signature,
                webhookSecret
            )

            if (!isValidSignature) {
                console.error('Invalid webhook signature')
                await logWebhookEvent(event, false, 'Invalid webhook signature')
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401 }
                )
            }
        }

        console.log(`Processing Cloudflare Stream webhook: ${event.eventType} for video ${event.uid}`)

        // Process the webhook event with retry logic
        await withRetry(
            async () => {
                // Update video status in database
                await updateVideoStatus(event.uid, event)

                // Send admin notifications for important events
                await sendAdminNotification(event)
            },
            `Webhook processing for ${event.eventType}`,
            0
        )

        // Log successful webhook processing
        await logWebhookEvent(event, true)

        console.log(`Successfully processed webhook ${event.eventId} for video ${event.uid}`)

        return NextResponse.json(
            {
                success: true,
                eventId: event.eventId,
                eventType: event.eventType,
                videoUid: event.uid
            },
            { status: 200 }
        )

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Webhook processing failed:', error)

        // Log failed webhook processing
        if (event!) {
            await logWebhookEvent(event, false, errorMessage)
        }

        return NextResponse.json(
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
    return NextResponse.json(
        { message: 'Cloudflare Stream webhook endpoint' },
        { status: 200 }
    )
}

export async function PUT() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    )
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    )
} 