import { createFileRoute } from '@tanstack/react-router'
import { GET, POST, PUT, DELETE, PATCH } from '@/src/server/auth/login'

export const Route = createFileRoute('/api/auth/login')({
    server: { handlers: { GET, POST, PUT, DELETE, PATCH } },
})
