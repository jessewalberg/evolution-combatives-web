import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/video-processing/get-processing'

export const Route = createFileRoute('/api/video-processing/get-processing')({
    server: { handlers: { GET } },
})
