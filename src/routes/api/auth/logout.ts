import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/auth/logout'

export const Route = createFileRoute('/api/auth/logout')({
    server: { handlers: { GET, POST } },
})
