import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/health'

export const Route = createFileRoute('/api/health')({
    server: { handlers: { GET } },
})
