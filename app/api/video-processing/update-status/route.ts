import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { cloudflareVideoId, updateData } = await request.json()

        if (!cloudflareVideoId) {
            return NextResponse.json(
                { success: false, error: 'Missing cloudflareVideoId' },
                { status: 400 }
            )
        }

        const supabase = createAdminClient()
        
        // Find video by Cloudflare video ID
        const { data: videos, error: findError } = await supabase
            .from('videos')
            .select('id, title, processing_status')
            .eq('cloudflare_video_id', cloudflareVideoId)

        if (findError) {
            console.error('Error finding video:', findError)
            return NextResponse.json(
                { success: false, error: 'Failed to find video' },
                { status: 500 }
            )
        }

        if (!videos || videos.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Video not found' },
                { status: 404 }
            )
        }

        const video = videos[0]
        console.log(`Updating video ${video.title} (${video.id}) status from ${video.processing_status} to ${updateData.processing_status}`)

        // Update video status
        const { data: updatedVideo, error: updateError } = await supabase
            .from('videos')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', video.id)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating video status:', updateError)
            return NextResponse.json(
                { success: false, error: 'Failed to update video status' },
                { status: 500 }
            )
        }

        console.log(`Successfully updated video ${video.title} status to ${updateData.processing_status}`)

        return NextResponse.json({
            success: true,
            video: updatedVideo
        })
    } catch (error) {
        console.error('Video processing update API error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}