import { createFileRoute } from '@tanstack/react-router'
import { GET, PUT, DELETE } from '@/src/server/content/categories-id'

export const Route = createFileRoute('/api/content/categories/$id')({
    server: { handlers: { GET, PUT, DELETE } },
})
