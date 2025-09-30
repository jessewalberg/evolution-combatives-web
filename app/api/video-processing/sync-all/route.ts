import { NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

export async function POST() {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const supabase = createAdminClient()

        // Get all videos currently in processing status
        const { data: processingVideos, error } = await supabase
            .from('videos')
            .select('id, cloudflare_video_id, title, processing_status, created_at')
            .eq('processing_status', 'processing')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch processing videos:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch processing videos' },
                { status: 500 }
            )
        }

        type VideoDetail = {
            videoId: string
            title: string
            error?: string
            oldStatus?: string
            newStatus?: string
            cloudflareStatus?: string
        }

        const results = {
            checked: 0,
            updated: 0,
            errors: 0,
            details: [] as VideoDetail[]
        }

        // Check each video with Cloudflare
        for (const video of processingVideos || []) {
            if (!video.cloudflare_video_id) {
                results.errors++
                results.details.push({
                    videoId: video.id,
                    title: video.title,
                    error: 'No Cloudflare video ID'
                })
                continue
            }

            try {
                results.checked++

                console.log(`Checking video ${video.title} (${video.id}) with Cloudflare ID: ${video.cloudflare_video_id}`)

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
                } = {
                    updated_at: new Date().toISOString()
                }

                // cloudflareStreamService returns UploadProgress directly
                if (cloudflareStatus.status === 'ready') {
                    updateData.processing_status = 'ready'
                    updateData.is_published = true
                    needsUpdate = true
                } else if (cloudflareStatus.status === 'error') {
                    updateData.processing_status = 'error'
                    needsUpdate = true
                }

                if (needsUpdate) {
                    const { error: updateError } = await supabase
                        .from('videos')
                        .update(updateData)
                        .eq('id', video.id)

                    if (updateError) {
                        results.errors++
                        results.details.push({
                            videoId: video.id,
                            title: video.title,
                            error: `Failed to update: ${updateError.message}`
                        })
                    } else {
                        results.updated++
                        results.details.push({
                            videoId: video.id,
                            title: video.title,
                            oldStatus: 'processing',
                            newStatus: updateData.processing_status,
                            cloudflareStatus: cloudflareStatus.status
                        })
                    }
                }

            } catch (error) {
                console.error(`Error checking video ${video.title} (${video.id}):`, error)
                results.errors++
                results.details.push({
                    videoId: video.id,
                    title: video.title,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        console.log(`Sync results: checked ${results.checked}, updated ${results.updated}, errors ${results.errors}`)

        // Log detailed error information
        if (results.errors > 0) {
            console.log('Error details:', results.details.filter(d => d.error))
        }

        return NextResponse.json({
            success: true,
            results
        })
    } catch (error) {
        console.error('Video processing sync API error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}