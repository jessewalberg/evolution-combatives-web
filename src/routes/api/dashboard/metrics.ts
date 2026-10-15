import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/dashboard/metrics'

export const Route = createFileRoute('/api/dashboard/metrics')({
    server: { handlers: { GET } },
})
