import { validateMobileAppAuth } from '@/src/lib/mobile-auth'
import { json } from '@/src/lib/http'

// Use exact subscription tiers from .cursorrules
type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3'

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
        // Import videoManagement inside the function to avoid environment variable issues
        const { videoManagement } = await import('@/src/services/cloudflare-stream')
        const requestBody = await request.json()
        const { videoId: requestVideoId, subscriptionTier = 'tier1', format = 'hls' } = requestBody
        videoId = requestVideoId; // Store for error handling

        if (!videoId) {
            return json(
                { success: false, error: 'Video ID is required' },
                { status: 400 }
            )
        }

        console.log('🎥 [Mobile API] Generating signed URL:', {
            videoId,
            subscriptionTier,
            format,
            userId: user.id,
            userEmail: user.email
        });

        // First, verify the video exists in Cloudflare Stream
        try {
            const videoDetails = await videoManagement.getVideoDetails(videoId);
            console.log('🎥 [Mobile API] Video exists in Cloudflare Stream:', {
                videoId,
                status: videoDetails.status,
                duration: videoDetails.duration,
                readyToStream: videoDetails.readyToStream
            });
        } catch (error) {
            console.error('❌ [Mobile API] Video not found in Cloudflare Stream:', error);
            return json(
                {
                    success: false,
                    error: 'Video not found in Cloudflare Stream',
                    details: `Video ${videoId} does not exist in Cloudflare Stream or is not accessible.`,
                    videoId: videoId
                },
                { status: 404 }
            );
        }

        // Generate signed URL with appropriate expiration based on subscription tier
        const signedUrl = await videoManagement.generateSignedUrl(
            videoId,
            subscriptionTier as SubscriptionTier,
            {
                downloadable: format === 'mp4', // Enable download for MP4 format
                // Set expiration based on subscription tier
                exp: Math.floor(Date.now() / 1000) + (
                    subscriptionTier === 'none' ? 30 * 60 : // 30 minutes for free
                        subscriptionTier === 'tier1' ? 2 * 60 * 60 : // 2 hours for tier1
                            subscriptionTier === 'tier2' ? 8 * 60 * 60 : // 8 hours for tier2
                                24 * 60 * 60 // 24 hours for tier3
                )
            },
            format as 'hls' | 'mp4' // Pass format to the service
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
                expires_at: new Date(Date.now() + (subscriptionTier === 'tier1' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString()
            }
        };

        console.log('✅ [Mobile API] Successfully generated video response for user:', user.email);

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