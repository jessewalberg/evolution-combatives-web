import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/content/categories'

export const Route = createFileRoute('/api/content/categories')({
    server: { handlers: { GET, POST } },
})
