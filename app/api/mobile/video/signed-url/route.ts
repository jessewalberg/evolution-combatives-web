import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateMobileBearer } from '../../../../../src/lib/mobile-auth'
import {
    SUBSCRIPTION_TIER_HIERARCHY,
    type SubscriptionTier,
} from '../../../../../src/lib/shared/constants/subscriptionTiers'

const SignedUrlRequestSchema = z
    .object({
        videoId: z.string().uuid(),
        format: z.enum(['hls', 'mp4']).default('hls'),
    })
    .strict()

const SIGNED_URL_TTL_SECONDS: Record<SubscriptionTier, number> = {
    none: 30 * 60,
    tier1: 2 * 60 * 60,
    tier2: 8 * 60 * 60,
    tier3: 24 * 60 * 60,
}

const isSubscriptionTier = (value: unknown): value is SubscriptionTier =>
    typeof value === 'string' && value in SUBSCRIPTION_TIER_HIERARCHY

const errorResponse = (status: number, error: string) =>
    NextResponse.json({ success: false, error }, { status })

/**
 * Generate a signed playback URL for a published application video.
 * Identity, content metadata, and entitlement are all resolved server-side.
 */
export async function POST(request: NextRequest) {
    const authResult = await authenticateMobileBearer(request)
    if ('error' in authResult) return authResult.error

    let requestData: z.infer<typeof SignedUrlRequestSchema>
    try {
        requestData = SignedUrlRequestSchema.parse(await request.json())
    } catch (error) {
        if (error instanceof z.ZodError) {
            return errorResponse(400, 'Invalid request data')
        }
        return errorResponse(400, 'Invalid JSON body')
    }

    const { user, supabase } = authResult.data
    const { videoId, format } = requestData

    const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(
            'id, cloudflare_video_id, duration_seconds, thumbnail_url, tier_required, processing_status, is_published'
        )
        .eq('id', videoId)
        .maybeSingle()

    if (videoError) {
        return errorResponse(500, 'Unable to verify video access')
    }

    if (!video || !video.is_published) {
        return errorResponse(404, 'Video not found')
    }

    if (video.processing_status !== 'ready' || !video.cloudflare_video_id) {
        return errorResponse(409, 'Video is not ready for playback')
    }

    if (!isSubscriptionTier(video.tier_required)) {
        return errorResponse(500, 'Video entitlement is not configured')
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('tier, status, current_period_end, created_at')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (subscriptionError) {
        return errorResponse(500, 'Unable to verify subscription access')
    }

    const periodIsCurrent =
        !subscription?.current_period_end ||
        new Date(subscription.current_period_end).getTime() > Date.now()
    const userTier =
        subscription &&
        periodIsCurrent &&
        isSubscriptionTier(subscription.tier)
            ? subscription.tier
            : 'none'

    if (
        SUBSCRIPTION_TIER_HIERARCHY[userTier] <
        SUBSCRIPTION_TIER_HIERARCHY[video.tier_required]
    ) {
        return errorResponse(403, 'Subscription tier does not permit this video')
    }

    // Offline/download access begins at tier 2, regardless of the video's tier.
    if (
        format === 'mp4' &&
        SUBSCRIPTION_TIER_HIERARCHY[userTier] <
            SUBSCRIPTION_TIER_HIERARCHY.tier2
    ) {
        return errorResponse(403, 'Subscription tier does not permit downloads')
    }

    if (
        !process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID ||
        !process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    ) {
        return errorResponse(503, 'Secure video playback is not configured')
    }

    try {
        const { videoManagement } = await import(
            '../../../../../src/services/cloudflare-stream'
        )
        const cloudflareVideoId = video.cloudflare_video_id
        const details = await videoManagement.getVideoDetails(cloudflareVideoId)

        if (!details.readyToStream || details.status.state !== 'ready') {
            return errorResponse(409, 'Video is not ready for playback')
        }

        if (!details.requireSignedURLs) {
            await videoManagement.updateVideoSettings(cloudflareVideoId, {
                requireSignedURLs: true,
            })
        }

        const expiresAtSeconds =
            Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS[userTier]
        const signedUrl = await videoManagement.generateSignedUrl(
            cloudflareVideoId,
            userTier,
            {
                downloadable: format === 'mp4',
                exp: expiresAtSeconds,
            },
            format
        )

        const parsedUrl = new URL(signedUrl)
        if (
            parsedUrl.protocol !== 'https:' ||
            !parsedUrl.searchParams.has('token')
        ) {
            throw new Error('Cloudflare returned an unsigned playback URL')
        }

        return NextResponse.json({
            success: true,
            data: {
                signed_url: signedUrl,
                video_id: video.id,
                duration: details.duration ?? video.duration_seconds ?? 0,
                thumbnail_url: details.thumbnail || video.thumbnail_url || null,
                expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
            },
        })
    } catch {
        return errorResponse(502, 'Secure video playback is temporarily unavailable')
    }
}
