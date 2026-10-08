import { json } from '@/src/lib/http'
import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { CloudflareStreamError } from '@/src/services/cloudflare-stream'

export async function POST({ request }: { request: Request }) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        // Import cloudflareStreamService inside the function to avoid environment variable issues
        const { cloudflareStreamService } = await import('@/src/services/cloudflare-stream')
        const { action, ...data } = await request.json()

        switch (action) {
            case 'getUploadUrl':
                const uploadOptions: {
                    maxDurationSeconds?: number
                    allowedOrigins?: string[]
                    thumbnailTimestampPct?: number
                    creator?: string
                    expiry?: string
                    scheduledDeletion?: string
                    metadata?: Record<string, string>
                } = {}
                if (typeof data.maxDurationSeconds === 'number') {
                    uploadOptions.maxDurationSeconds = data.maxDurationSeconds
                }
                if (Array.isArray(data.allowedOrigins)) {
                    uploadOptions.allowedOrigins = data.allowedOrigins.filter(
                        (o: unknown) => typeof o === 'string'
                    )
                }
                if (typeof data.thumbnailTimestampPct === 'number') {
                    uploadOptions.thumbnailTimestampPct = data.thumbnailTimestampPct
                }
                if (typeof data.creator === 'string') {
                    uploadOptions.creator = data.creator
                }
                if (typeof data.expiry === 'string') {
                    uploadOptions.expiry = data.expiry
                }
                if (typeof data.scheduledDeletion === 'string') {
                    uploadOptions.scheduledDeletion = data.scheduledDeletion
                }
                if (data.metadata && typeof data.metadata === 'object') {
                    uploadOptions.metadata = {}
                    for (const [k, v] of Object.entries(data.metadata)) {
                        if (typeof v === 'string') {
                            uploadOptions.metadata[k] = v
                        }
                    }
                }
                const uploadUrl = await cloudflareStreamService.upload.getUploadUrl(uploadOptions)
                return json({ success: true, data: uploadUrl })

            case 'checkUploadStatus':
                const status = await cloudflareStreamService.upload.checkUploadStatus(data.streamId)
                return json({ success: true, data: status })

            case 'generateAdminPreviewUrl':
                const previewUrl = await cloudflareStreamService.security.generateAdminPreviewUrl(data.videoId)
                return json({ success: true, data: { previewUrl } })

            case 'generateThumbnailUrl':
                const thumbnailUrl = await cloudflareStreamService.video.generateThumbnailUrl(data.videoId, data.options)
                return json({ success: true, data: { thumbnailUrl } })

            case 'retryProcessing':
                await cloudflareStreamService.video.retryProcessing(data.videoId)
                return json({ success: true })

            default:
                return json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                )
        }
    } catch (error) {
        if (error instanceof CloudflareStreamError && error.code === 400) {
            return json(
                { success: false, error: error.message },
                { status: 400 }
            )
        }
        console.error('Cloudflare API error:', error)
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
