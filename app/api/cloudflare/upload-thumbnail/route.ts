/**
 * Evolution Combatives - Cloudflare Custom Thumbnail Upload API
 * Server-side endpoint for uploading custom video thumbnails
 * 
 * @description Upload custom thumbnails to Cloudflare Stream
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server'
import { cloudflareStreamService } from '../../../../src/services/cloudflare-stream'
import { createServerClient } from '../../../../src/lib/supabase'

/**
 * POST /api/cloudflare/upload-thumbnail
 * Upload a custom thumbnail for a video
 */
export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const supabase = await createServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'You must be logged in to upload thumbnails' },
                { status: 401 }
            )
        }

        // Verify admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('admin_role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile?.admin_role) {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Only admins can upload thumbnails' },
                { status: 403 }
            )
        }

        // Check if user has content.write permission
        const allowedRoles = ['super_admin', 'content_admin']
        if (!allowedRoles.includes(profile.admin_role)) {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Insufficient permissions to upload thumbnails' },
                { status: 403 }
            )
        }

        // Parse multipart form data
        const formData = await request.formData()
        const videoId = formData.get('videoId') as string
        const thumbnailFile = formData.get('thumbnail') as File
        const timestampStr = formData.get('timestamp') as string | null

        if (!videoId) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'videoId is required' },
                { status: 400 }
            )
        }

        if (!thumbnailFile) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'thumbnail file is required' },
                { status: 400 }
            )
        }

        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!validImageTypes.includes(thumbnailFile.type)) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed' },
                { status: 400 }
            )
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (thumbnailFile.size > maxSize) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'File too large. Maximum size is 5MB' },
                { status: 400 }
            )
        }

        // Verify video exists in database
        const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('id, cloudflare_video_id, title')
            .eq('id', videoId)
            .single()

        if (videoError || !video) {
            return NextResponse.json(
                { error: 'Not Found', message: 'Video not found' },
                { status: 404 }
            )
        }

        if (!video.cloudflare_video_id) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'Video does not have a Cloudflare video ID' },
                { status: 400 }
            )
        }

        // Parse timestamp if provided
        const timestamp = timestampStr ? parseFloat(timestampStr) : undefined

        // Upload thumbnail to Cloudflare Stream
        const thumbnailUrl = await cloudflareStreamService.video.uploadCustomThumbnail(
            video.cloudflare_video_id,
            thumbnailFile,
            timestamp
        )

        // Update video record in database with new thumbnail URL
        const { error: updateError } = await supabase
            .from('videos')
            .update({
                thumbnail_url: thumbnailUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId)

        if (updateError) {
            console.error('Failed to update video thumbnail URL in database:', updateError)
            return NextResponse.json(
                { error: 'Database Error', message: 'Failed to update video record' },
                { status: 500 }
            )
        }

        // Log admin activity
        await supabase
            .from('admin_activity')
            .insert({
                admin_id: user.id,
                action: 'video.thumbnail.update',
                resource_type: 'video',
                resource_id: videoId,
                details: {
                    video_title: video.title,
                    cloudflare_video_id: video.cloudflare_video_id,
                    thumbnail_size: thumbnailFile.size,
                    thumbnail_type: thumbnailFile.type
                }
            })

        return NextResponse.json({
            success: true,
            thumbnailUrl,
            message: 'Thumbnail uploaded successfully'
        })

    } catch (error) {
        console.error('Thumbnail upload error:', error)

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Failed to upload thumbnail'
            },
            { status: 500 }
        )
    }
}

