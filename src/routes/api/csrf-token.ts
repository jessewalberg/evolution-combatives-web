import { createFileRoute } from '@tanstack/react-router'
import { GET } from '@/src/server/csrf-token'

export const Route = createFileRoute('/api/csrf-token')({
    server: { handlers: { GET } },
})
