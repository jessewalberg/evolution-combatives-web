import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/content/categories-merge'

export const Route = createFileRoute('/api/content/categories/merge')({
    server: { handlers: { POST } },
})
