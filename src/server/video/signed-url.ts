import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig, createAdminClient } from '@/src/lib/supabase'
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

async function validateBearerAuth(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization')
        console.log('🔐 Admin API Auth Debug:', {
            hasAuthHeader: !!authHeader,
            headerLength: authHeader?.length
        })

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                error: json(
                    { success: false, error: 'Authentication required' },
                    { status: 401 }
                )
            }
        }

        const token = authHeader.replace('Bearer ', '')

        const { url, anonKey } = getSupabaseConfig()
        const supabase = createClient(url, anonKey,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        console.log('🔐 User Validation Result:', {
            hasUser: !!user,
            userId: user?.id,
            hasError: !!userError
        })

        if (userError || !user) {
            console.error('❌ User validation failed')
            return {
                error: json(
                    { success: false, error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }
        }

        console.log('✅ User authenticated successfully:', user.id)
        return { user, supabase }
    } catch (error) {
        console.error('Auth validation error:', error)
        return {
            error: json(
                { success: false, error: 'Authentication failed' },
                { status: 500 }
            )
        }
    }
}

export async function POST({ request }: { request: Request }) {
    const authResult = await validateBearerAuth(request)
    if ('error' in authResult) {
        return authResult.error
    }

    const { user } = authResult
    let videoId: string | undefined

    try {
        const { videoManagement } = await import('@/src/services/cloudflare-stream')
        const requestBody = await request.json()
        const { videoId: requestVideoId, format = 'hls' } = requestBody
        videoId = requestVideoId

        if (!videoId) {
            return json(
                { error: 'Video ID is required' },
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
            console.error('❌ Video not found in database')
            return json(
                {
                    error: 'Video not found',
                    videoId
                },
                { status: 404 }
            )
        }

        // Deny access to unpublished videos
        if (!video.is_published) {
            console.warn('🚫 Access denied - video not published:', { videoId })
            return json(
                { error: 'Video not available' },
                { status: 403 }
            )
        }

        const dbRequiredTier = video.tier_required
        const requiredTier: SubscriptionTier = isValidTier(dbRequiredTier) ? dbRequiredTier : 'none'

        // Authorization check: verify user's subscription tier >= video's required tier
        if (SUBSCRIPTION_TIER_HIERARCHY[userTier] < SUBSCRIPTION_TIER_HIERARCHY[requiredTier]) {
            console.warn('🚫 Access denied - insufficient entitlement:', {
                userId: user.id,
                videoId
            })
            return json(
                {
                    error: 'Subscription tier too low',
                    details: `This video requires ${requiredTier} subscription`
                },
                { status: 403 }
            )
        }

        console.log('🎥 Generating signed URL:', {
            videoId,
            format,
            userId: user.id
        })

        // Verify video exists in Cloudflare Stream
        try {
            const streamDetails = await videoManagement.getVideoDetails(videoId)
            console.log('🎥 Video exists in Cloudflare Stream:', {
                videoId,
                status: streamDetails.status,
                duration: streamDetails.duration,
                readyToStream: streamDetails.readyToStream
            })
        } catch (error) {
            console.error('❌ Video not found in Cloudflare Stream:', error)
            return json(
                {
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

        console.log('🎥 Generated signed URL:', {
            url: signedUrl,
            urlLength: signedUrl.length,
            hasToken: signedUrl.includes('token='),
            tokenPreview: signedUrl.split('token=')[1]?.substring(0, 50) + '...'
        });

        // Test the signed URL by fetching it
        try {
            console.log('🧪 Testing signed URL accessibility...');
            const testResponse = await fetch(signedUrl, { method: 'HEAD' });
            console.log('🧪 URL test result:', {
                status: testResponse.status,
                statusText: testResponse.statusText,
                contentType: testResponse.headers.get('content-type'),
                accessible: testResponse.ok
            });
        } catch (testError) {
            console.error('🧪 URL test failed:', testError);
        }

        // Get video metadata for additional info
        const videoDetails = await videoManagement.getVideoDetails(videoId)

        return json({
            success: true,
            data: {
                signed_url: signedUrl,
                video_id: videoId,
                duration: videoDetails.duration || 0,
                thumbnail_url: videoDetails.thumbnail || null,
                expires_at: new Date(Date.now() + getExpirationSeconds(userTier) * 1000).toISOString()
            }
        })

    } catch (error) {
        console.error('Error generating signed video URL:', error)

        // Handle specific Cloudflare Stream errors
        if (error instanceof Error && error.message.includes('Not Found')) {
            return json(
                {
                    error: 'Video not found',
                    details: `Video ${videoId || 'unknown'} does not exist in Cloudflare Stream. This may be a development/test video that hasn't been uploaded yet.`,
                    videoId: videoId
                },
                { status: 404 }
            )
        }

        return json(
            {
                error: 'Failed to generate signed video URL',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
