import { NextRequest, NextResponse } from 'next/server'
import { contentQueries } from '../../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const videoId = params.id
        
        if (!videoId) {
            return NextResponse.json(
                { success: false, error: 'Video ID is required' },
                { status: 400 }
            )
        }

        console.log('Fetching video by ID:', videoId)
        const video = await contentQueries.fetchVideoById(videoId)
        
        if (!video) {
            return NextResponse.json(
                { success: false, error: 'Video not found' },
                { status: 404 }
            )
        }

        console.log('Video fetch result:', video.id, video.title)
        return NextResponse.json({ success: true, data: video })
    } catch (error) {
        console.error('Video by ID GET API error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}