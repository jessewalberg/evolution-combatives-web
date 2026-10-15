import { createFileRoute } from '@tanstack/react-router'
import { GET, POST, PUT, DELETE, PATCH } from '@/src/server/auth/sign-up'

export const Route = createFileRoute('/api/auth/sign-up')({
    server: { handlers: { GET, POST, PUT, DELETE, PATCH } },
})
