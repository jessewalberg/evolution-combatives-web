import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/video-processing/sync-all'

export const Route = createFileRoute('/api/video-processing/sync-all')({
    server: { handlers: { POST } },
})
