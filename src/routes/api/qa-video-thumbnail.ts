import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/qa-video-thumbnail'

export const Route = createFileRoute('/api/qa-video-thumbnail')({
    server: { handlers: { GET } },
})
