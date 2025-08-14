import { NextRequest, NextResponse } from 'next/server'
import { contentMutations, contentQueries } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

export async function GET(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || undefined
        const categoryId = searchParams.get('categoryId') || undefined
        
        const filters = {
            search,
            categoryId
        }
        
        const pagination = {
            page: 1,
            pageSize: 100,
            orderBy: 'created_at',
            orderDirection: 'desc' as const
        }
        
        console.log('Fetching videos with filters:', filters, 'pagination:', pagination)
        const result = await contentQueries.fetchVideos(filters, pagination)
        console.log('Videos fetch result:', { totalCount: result.totalCount, dataLength: result.data?.length })
        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error('Videos GET API error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { action, ...data } = await request.json()

        switch (action) {
            case 'create':
                console.log('Creating video - received data:', data.videoData)
                const video = await contentMutations.createVideo(data.videoData)
                console.log('Video created successfully:', video)
                return NextResponse.json({ success: true, data: video })
            
            case 'update':
                const updatedVideo = await contentMutations.updateVideo(data.id, data.updateData)
                return NextResponse.json({ success: true, data: updatedVideo })
            
            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Content API error:', error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}