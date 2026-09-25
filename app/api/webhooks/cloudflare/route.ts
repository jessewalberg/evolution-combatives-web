import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '../../../../src/lib/supabase'
import { verifyCloudflareWebhookSignature } from './signature'

const CloudflareStreamPayloadSchema = z
    .object({
        uid: z.string().min(1).max(128),
        readyToStream: z.boolean(),
        status: z
            .object({
                state: z.enum([
                    'pendingupload',
                    'downloading',
                    'queued',
                    'inprogress',
                    'ready',
                    'error',
                ]),
                pctComplete: z.string().optional(),
                errorReasonCode: z.string().optional(),
                errorReasonText: z.string().optional(),
                errReasonCode: z.string().optional(),
                errReasonText: z.string().optional(),
            })
            .passthrough(),
        thumbnail: z.string().url().nullable().optional(),
        duration: z.number().finite().nonnegative().nullable().optional(),
        size: z.number().int().nonnegative().nullable().optional(),
        modified: z.string().optional(),
    })
    .passthrough()

type CloudflareStreamPayload = z.infer<typeof CloudflareStreamPayloadSchema>

interface VideoRow {
    id: string
    processing_status: string | null
    is_published: boolean | null
    duration_seconds: number | null
    thumbnail_url: string | null
    file_size: number | null
}

interface ProcessResult {
    videoId?: string
    state: CloudflareStreamPayload['status']['state']
    updated: boolean
    ignored: boolean
}

function valuesMatch(current: VideoRow, desired: Record<string, unknown>): boolean {
    return Object.entries(desired).every(([key, desiredValue]) => {
        const currentValue = current[key as keyof VideoRow]
        return currentValue === desiredValue
    })
}

/**
 * Apply terminal Stream state deterministically. Repeated delivery produces the
 * same desired values and skips the write, which makes processing idempotent
 * without relying on an event ID Cloudflare does not provide.
 */
async function processStreamPayload(
    payload: CloudflareStreamPayload
): Promise<ProcessResult> {
    const state = payload.status.state
    const isReady = state === 'ready' && payload.readyToStream
    const isError = state === 'error'

    // Stream documents webhook delivery for terminal ready/error results. Safely
    // acknowledge an unexpected non-terminal snapshot without changing state.
    if (!isReady && !isError) {
        return { state, updated: false, ignored: true }
    }

    const supabase = createAdminClient()
    const { data, error: fetchError } = await supabase
        .from('videos')
        .select(
            'id, processing_status, is_published, duration_seconds, thumbnail_url, file_size'
        )
        .eq('cloudflare_video_id', payload.uid)
        .maybeSingle()

    const video = data as VideoRow | null
    if (fetchError) {
        throw new Error('Unable to load the webhook video')
    }
    if (!video) {
        throw new Error('Webhook video is not registered')
    }

    const desired: Record<string, unknown> = {
        processing_status: isReady ? 'ready' : 'error',
    }

    if (isReady) {
        // Publishing remains an explicit admin decision.
        if (payload.duration !== null && payload.duration !== undefined) {
            desired.duration_seconds = Math.round(payload.duration)
        }
        if (payload.thumbnail) desired.thumbnail_url = payload.thumbnail
        if (payload.size !== null && payload.size !== undefined) {
            desired.file_size = payload.size
        }
    } else {
        // A broken asset must not remain playable if it was previously published.
        desired.is_published = false
    }

    if (valuesMatch(video, desired)) {
        return { videoId: video.id, state, updated: false, ignored: false }
    }

    const { error: updateError } = await supabase
        .from('videos')
        .update({ ...desired, updated_at: new Date().toISOString() })
        .eq('id', video.id)
        .eq('cloudflare_video_id', payload.uid)

    if (updateError) {
        throw new Error('Unable to update the webhook video')
    }

    return { videoId: video.id, state, updated: true, ignored: false }
}

export async function POST(request: NextRequest) {
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET
    if (!secret) {
        return NextResponse.json(
            { success: false, error: 'Webhook verification is not configured' },
            { status: 503 }
        )
    }

    const rawBody = await request.text()
    if (!rawBody) {
        return NextResponse.json(
            { success: false, error: 'Empty payload' },
            { status: 400 }
        )
    }

    const verification = verifyCloudflareWebhookSignature(
        rawBody,
        request.headers.get('webhook-signature'),
        secret
    )
    if (!verification.valid) {
        return NextResponse.json(
            { success: false, error: 'Invalid signature' },
            { status: 401 }
        )
    }

    let payload: CloudflareStreamPayload
    try {
        payload = CloudflareStreamPayloadSchema.parse(JSON.parse(rawBody))
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof SyntaxError
                        ? 'Invalid JSON payload'
                        : 'Invalid webhook payload',
            },
            { status: 400 }
        )
    }

    try {
        const result = await processStreamPayload(payload)
        return NextResponse.json({
            success: true,
            videoUid: payload.uid,
            state: result.state,
            videoId: result.videoId,
            updated: result.updated,
            ignored: result.ignored,
        })
    } catch {
        // A non-2xx response allows Cloudflare to redeliver after transient
        // database or ordering failures without exposing internal details.
        return NextResponse.json(
            { success: false, error: 'Webhook processing failed' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Cloudflare Stream webhook endpoint' })
}

const methodNotAllowed = () =>
    NextResponse.json({ error: 'Method not allowed' }, { status: 405 })

export const PUT = methodNotAllowed
export const DELETE = methodNotAllowed
