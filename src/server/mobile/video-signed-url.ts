import { validateMobileAppAuth } from '@/src/lib/mobile-auth'
import { createAdminClient } from '@/src/lib/supabase'
import { json } from '@/src/lib/http'
import { 
    SUBSCRIPTION_TIER_HIERARCHY,
    type SubscriptionTier 
} from '@/src/lib/shared/constants/subscriptionTiers'

function isValidTier(tier: unknown): tier is SubscriptionTier {
    return typeof tier === 'string' && tier in SUBSCRIPTION_TIER_HIERARCHY
}

function getExpirationSeconds(tier: SubscriptionTier): number {
    switch (tier) {
        case 'none': return 30 * 60        // 30 minutes
        case 'tier1': return 2 * 60 * 60   // 2 hours
        case 'tier2': return 8 * 60 * 60   // 8 hours
        case 'tier3': return 24 * 60 * 60  // 24 hours
    }
}

/**
 * Mobile-specific video API endpoint
 * This endpoint bypasses CSRF protection since mobile apps use Bearer token auth
 * and are not subject to CSRF attacks like web browsers
 */
export async function POST({ request }: { request: Request }) {
    console.log('📱 [Mobile API] Incoming video request');

    const authResult = await validateMobileAppAuth(request)
    if ('error' in authResult) {
        return authResult.error
    }

    const { user } = authResult

    let videoId: string | undefined;

    try {
        const { videoManagement } = await import('@/src/services/cloudflare-stream')
        const requestBody = await request.json()
        const { videoId: requestVideoId, format = 'hls' } = requestBody
        videoId = requestVideoId

        if (!videoId) {
            return json(
                { success: false, error: 'Video ID is required' },
                { status: 400 }
            )
        }

        // Derive entitlement from server-written subscriptions table
        const adminClient = createAdminClient()
        const { data: subscription } = await adminClient
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .maybeSingle()

        const dbTier = subscription?.tier
        const userTier: SubscriptionTier = isValidTier(dbTier) ? dbTier : 'none'

        // Fetch video metadata from database to get tier_required and is_published
        const { data: video, error: videoError } = await adminClient
            .from('videos')
            .select('id, tier_required, cloudflare_video_id, title, is_published')
            .eq('cloudflare_video_id', videoId)
            .single()

        if (videoError || !video) {
            console.error('❌ [Mobile API] Video not found in database')
            return json(
                {
                    success: false,
                    error: 'Video not found',
                    videoId
                },
                { status: 404 }
            )
        }

        // Deny access to unpublished videos
        if (!video.is_published) {
            console.warn('🚫 [Mobile API] Access denied - video not published:', { videoId })
            return json(
                { success: false, error: 'Video not available' },
                { status: 403 }
            )
        }

        const dbRequiredTier = video.tier_required
        const requiredTier: SubscriptionTier = isValidTier(dbRequiredTier) ? dbRequiredTier : 'none'

        // Authorization check: verify user's subscription tier >= video's required tier
        if (SUBSCRIPTION_TIER_HIERARCHY[userTier] < SUBSCRIPTION_TIER_HIERARCHY[requiredTier]) {
            console.warn('🚫 [Mobile API] Access denied - insufficient entitlement:', {
                userId: user.id,
                videoId
            })
            return json(
                {
                    success: false,
                    error: 'Subscription tier too low',
                    details: `This video requires ${requiredTier} subscription`
                },
                { status: 403 }
            )
        }

        console.log('🎥 [Mobile API] Generating signed URL:', {
            videoId,
            format,
            userId: user.id
        })

        // Verify video exists in Cloudflare Stream
        try {
            const streamDetails = await videoManagement.getVideoDetails(videoId)
            console.log('🎥 [Mobile API] Video exists in Cloudflare Stream:', {
                videoId,
                status: streamDetails.status,
                duration: streamDetails.duration,
                readyToStream: streamDetails.readyToStream
            })
        } catch (error) {
            console.error('❌ [Mobile API] Video not found in Cloudflare Stream:', error)
            return json(
                {
                    success: false,
                    error: 'Video not found in Cloudflare Stream',
                    details: `Video ${videoId} does not exist in Cloudflare Stream or is not accessible.`,
                    videoId
                },
                { status: 404 }
            )
        }

        // Generate signed URL using user's ACTUAL subscription tier (not client-provided)
        const signedUrl = await videoManagement.generateSignedUrl(
            videoId,
            userTier,
            {
                downloadable: format === 'mp4',
                exp: Math.floor(Date.now() / 1000) + getExpirationSeconds(userTier)
            },
            format as 'hls' | 'mp4'
        )

        console.log('🎥 [Mobile API] Generated signed URL:', {
            url: signedUrl,
            urlLength: signedUrl.length,
            hasToken: signedUrl.includes('token='),
            tokenPreview: signedUrl.split('token=')[1]?.substring(0, 50) + '...'
        });

        // Test the signed URL by fetching it
        try {
            console.log('🧪 [Mobile API] Testing signed URL accessibility...');
            const testResponse = await fetch(signedUrl, { method: 'HEAD' });
            console.log('🧪 [Mobile API] URL test result:', {
                status: testResponse.status,
                statusText: testResponse.statusText,
                contentType: testResponse.headers.get('content-type'),
                accessible: testResponse.ok
            });
        } catch (testError) {
            console.error('🧪 [Mobile API] URL test failed:', testError);
        }

        // Get video metadata for additional info
        const videoDetails = await videoManagement.getVideoDetails(videoId)

        const response = {
            success: true,
            data: {
                signed_url: signedUrl,
                video_id: videoId,
                duration: videoDetails.duration || 0,
                thumbnail_url: videoDetails.thumbnail || null,
                expires_at: new Date(Date.now() + getExpirationSeconds(userTier) * 1000).toISOString()
            }
        }

        console.log('✅ [Mobile API] Successfully generated video response for user:', user.id);

        return json(response)

    } catch (error) {
        console.error('[Mobile API] Error generating signed video URL:', error)

        // Handle specific Cloudflare Stream errors
        if (error instanceof Error && error.message.includes('Not Found')) {
            return json(
                {
                    success: false,
                    error: 'Video not found',
                    details: `Video ${videoId || 'unknown'} does not exist in Cloudflare Stream. This may be a development/test video that hasn't been uploaded yet.`,
                    videoId: videoId
                },
                { status: 404 }
            )
        }

        return json(
            {
                success: false,
                error: 'Failed to generate signed video URL',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}