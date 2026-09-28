import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/admin/content'

export const Route = createFileRoute('/api/admin/content')({
    server: { handlers: { POST } },
})
