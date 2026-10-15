import { createFileRoute } from '@tanstack/react-router'
import { GET, PUT, DELETE } from '@/src/server/content/disciplines-id'

export const Route = createFileRoute('/api/content/disciplines/$id')({
    server: { handlers: { GET, PUT, DELETE } },
})
