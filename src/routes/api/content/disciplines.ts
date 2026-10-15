import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/content/disciplines'

export const Route = createFileRoute('/api/content/disciplines')({
    server: { handlers: { GET, POST } },
})
