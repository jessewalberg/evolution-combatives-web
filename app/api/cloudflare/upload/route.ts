import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        // Import cloudflareStreamService inside the function to avoid environment variable issues
        const { cloudflareStreamService } = await import('../../../../src/services/cloudflare-stream')
        const { action, ...data } = await request.json()

        switch (action) {
            case 'getUploadUrl':
                const uploadUrl = await cloudflareStreamService.upload.getUploadUrl(data)
                return NextResponse.json({ success: true, data: uploadUrl })

            case 'checkUploadStatus':
                const status = await cloudflareStreamService.upload.checkUploadStatus(data.streamId)
                return NextResponse.json({ success: true, data: status })

            case 'generateAdminPreviewUrl':
                const previewUrl = await cloudflareStreamService.security.generateAdminPreviewUrl(data.videoId)
                return NextResponse.json({ success: true, data: { previewUrl } })

            case 'generateThumbnailUrl':
                const thumbnailUrl = await cloudflareStreamService.video.generateThumbnailUrl(data.videoId, data.options)
                return NextResponse.json({ success: true, data: { thumbnailUrl } })

            case 'retryProcessing':
                await cloudflareStreamService.video.retryProcessing(data.videoId)
                return NextResponse.json({ success: true })

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Cloudflare API error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}