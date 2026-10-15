import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/content/categories-reorder'

export const Route = createFileRoute('/api/content/categories/reorder')({
    server: { handlers: { POST } },
})
