import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/video-processing/sync-single'

export const Route = createFileRoute('/api/video-processing/sync-single')({
    server: { handlers: { POST } },
})
