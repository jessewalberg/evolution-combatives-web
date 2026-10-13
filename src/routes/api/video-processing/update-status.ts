import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/video-processing/update-status'

export const Route = createFileRoute('/api/video-processing/update-status')({
    server: { handlers: { POST } },
})
