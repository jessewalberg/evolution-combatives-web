import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { videoId } = await request.json()

        if (!videoId) {
            return NextResponse.json(
                { success: false, error: 'Video ID is required' },
                { status: 400 }
            )
        }

        const supabase = createAdminClient()

        // Get the specific video
        const { data: video, error } = await supabase
            .from('videos')
            .select('id, cloudflare_video_id, title, processing_status, created_at')
            .eq('id', videoId)
            .single()

        if (error || !video) {
            return NextResponse.json(
                { success: false, error: 'Video not found' },
                { status: 404 }
            )
        }

        if (!video.cloudflare_video_id) {
            return NextResponse.json(
                { success: false, error: 'No Cloudflare video ID' },
                { status: 400 }
            )
        }

        // Import cloudflareStreamService inside the function to avoid environment variable issues
        const { cloudflareStreamService } = await import('../../../../src/services/cloudflare-stream')

        // Check status with Cloudflare directly
        const cloudflareStatus = await cloudflareStreamService.upload.checkUploadStatus(video.cloudflare_video_id)

        let needsUpdate = false
        const updateData: {
            updated_at: string
            processing_status?: 'ready' | 'error'
            is_published?: boolean
            duration_seconds?: number
            thumbnail_url?: string
        } = {
            updated_at: new Date().toISOString()
        }

        // Update database if status changed
        if (cloudflareStatus.status === 'ready') {
            // Get full video details to capture duration and metadata
            const videoDetails = await cloudflareStreamService.video.getVideoDetails(video.cloudflare_video_id)

            updateData.processing_status = 'ready'
            updateData.is_published = true

            // Capture duration if available
            if (videoDetails.duration) {
                updateData.duration_seconds = Math.round(videoDetails.duration)
            }

            // Generate and store thumbnail URL
            updateData.thumbnail_url = await cloudflareStreamService.video.generateThumbnailUrl(video.cloudflare_video_id)

            needsUpdate = true
        } else if (cloudflareStatus.status === 'error') {
            updateData.processing_status = 'error'
            needsUpdate = true
        }

        const result = {
            videoId: video.id,
            title: video.title,
            oldStatus: video.processing_status,
            newStatus: updateData.processing_status || video.processing_status,
            cloudflareStatus: cloudflareStatus.status,
            updated: false
        }

        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('videos')
                .update(updateData)
                .eq('id', video.id)

            if (updateError) {
                console.error(`Failed to update video ${video.title}:`, updateError)
                return NextResponse.json(
                    { success: false, error: `Failed to update video: ${updateError.message}` },
                    { status: 500 }
                )
            } else {
                result.updated = true
                console.info(`Video sync: ${video.title} updated ${video.processing_status} → ${updateData.processing_status}`)
            }
        }

        return NextResponse.json({
            success: true,
            result
        })
    } catch (error) {
        console.error('Single video sync API error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
