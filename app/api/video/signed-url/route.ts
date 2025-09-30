import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use exact subscription tiers from .cursorrules
type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3'

async function validateMobileAppAuth(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        console.log('🔐 Admin API Auth Debug:', {
            hasAuthHeader: !!authHeader,
            authHeaderStart: authHeader?.substring(0, 20) + '...',
            headerLength: authHeader?.length
        });

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                error: NextResponse.json(
                    { success: false, error: 'Authentication required' },
                    { status: 401 }
                )
            }
        }

        const token = authHeader.replace('Bearer ', '')

        // Create Supabase client with the provided JWT token
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        )

        // Verify the user with the token
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        console.log('🔐 User Validation Result:', {
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
            hasError: !!userError,
            errorMessage: userError?.message
        });

        if (userError || !user) {
            console.error('❌ User validation failed:', userError);
            return {
                error: NextResponse.json(
                    { success: false, error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }
        }

        console.log('✅ User authenticated successfully:', user.email);
        return { user, supabase }
    } catch (error) {
        console.error('Auth validation error:', error)
        return {
            error: NextResponse.json(
                { success: false, error: 'Authentication failed' },
                { status: 500 }
            )
        }
    }
}

export async function POST(request: NextRequest) {
    const authResult = await validateMobileAppAuth(request)
    if ('error' in authResult) {
        return authResult.error
    }

    const { } = authResult

    let videoId: string | undefined;

    try {
        // Import videoManagement inside the function to avoid environment variable issues
        const { videoManagement } = await import('../../../../src/services/cloudflare-stream')
        const requestBody = await request.json()
        const { videoId: requestVideoId, subscriptionTier = 'tier1', format = 'hls' } = requestBody
        videoId = requestVideoId; // Store for error handling

        if (!videoId) {
            return NextResponse.json(
                { error: 'Video ID is required' },
                { status: 400 }
            )
        }

        console.log('🎥 Generating signed URL:', { videoId, subscriptionTier, format });

        // First, verify the video exists in Cloudflare Stream
        try {
            const videoDetails = await videoManagement.getVideoDetails(videoId);
            console.log('🎥 Video exists in Cloudflare Stream:', {
                videoId,
                status: videoDetails.status,
                duration: videoDetails.duration,
                readyToStream: videoDetails.readyToStream
            });
        } catch (error) {
            console.error('❌ Video not found in Cloudflare Stream:', error);
            return NextResponse.json(
                {
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

        return NextResponse.json({
            success: true,
            data: {
                signed_url: signedUrl,
                video_id: videoId,
                duration: videoDetails.duration || 0,
                thumbnail_url: videoDetails.thumbnail || null,
                expires_at: new Date(Date.now() + (subscriptionTier === 'tier1' ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString()
            }
        })

    } catch (error) {
        console.error('Error generating signed video URL:', error)

        // Handle specific Cloudflare Stream errors
        if (error instanceof Error && error.message.includes('Not Found')) {
            return NextResponse.json(
                {
                    error: 'Video not found',
                    details: `Video ${videoId || 'unknown'} does not exist in Cloudflare Stream. This may be a development/test video that hasn't been uploaded yet.`,
                    videoId: videoId
                },
                { status: 404 }
            )
        }

        return NextResponse.json(
            {
                error: 'Failed to generate signed video URL',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
