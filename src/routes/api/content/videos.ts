import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/content/videos'

export const Route = createFileRoute('/api/content/videos')({
    server: { handlers: { GET, POST } },
})
