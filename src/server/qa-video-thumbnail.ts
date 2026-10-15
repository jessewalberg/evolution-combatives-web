import { hasPermission, validateApiAuthWithSession } from '@/src/lib/api-auth'
import { createAdminClient } from '@/src/lib/supabase'
import { CloudflareStreamError, cloudflareStreamService } from '@/src/services/cloudflare-stream'

const cacheControl = 'private, no-store'

function emptyResponse(status: number): Response {
    return new Response(null, { status, headers: { 'Cache-Control': cacheControl } })
}

export async function GET({ request }: { request: Request }): Promise<Response> {
    const authResult = await validateApiAuthWithSession('users.read')
    if ('error' in authResult) {
        authResult.error.headers.set('Cache-Control', cacheControl)
        return authResult.error
    }

    const canReadContent = hasPermission(authResult.user.role, 'content.read')
    if (!canReadContent && !hasPermission(authResult.user.role, 'support.read')) {
        return emptyResponse(403)
    }

    const videoId = new URL(request.url).searchParams.get('videoId')
    if (!videoId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
        return emptyResponse(400)
    }

    try {
        const admin = createAdminClient()
        const { data: video, error: videoError } = await admin
            .from('videos')
            .select('id, cloudflare_video_id')
            .eq('id', videoId)
            .maybeSingle()
        if (videoError) throw videoError
        if (!video?.cloudflare_video_id) return emptyResponse(404)

        if (!canReadContent) {
            const { data: questions, error: questionError } = await admin
                .from('questions')
                .select('id')
                .eq('video_id', video.id)
                .limit(1)
            if (questionError) throw questionError
            if (!questions?.length) return emptyResponse(403)
        }

        const thumbnailUrl = await cloudflareStreamService.video.generateThumbnailUrl(video.cloudflare_video_id)
        const image = await fetch(thumbnailUrl, { redirect: 'manual' })
        const contentType = image.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
        if (!image.ok || !image.body || !contentType || !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(contentType)) {
            return emptyResponse(502)
        }

        return new Response(image.body, {
            status: 200,
            headers: {
                'Cache-Control': cacheControl,
                'Content-Type': contentType,
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        return emptyResponse(error instanceof CloudflareStreamError && error.code === 503 ? 503 : 502)
    }
}
