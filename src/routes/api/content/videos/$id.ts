import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/content/videos-id'

export const Route = createFileRoute('/api/content/videos/$id')({
    server: { handlers: { GET } },
})
