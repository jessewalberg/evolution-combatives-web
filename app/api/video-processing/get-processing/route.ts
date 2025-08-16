import { NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

export async function GET() {
    const authResult = await validateApiAuthWithSession('content.read')
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

        console.log(`Found ${processingVideos?.length || 0} videos in processing status`)

        return NextResponse.json({
            success: true,
            processingVideos: processingVideos || []
        })
    } catch (error) {
        console.error('Video processing GET API error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}