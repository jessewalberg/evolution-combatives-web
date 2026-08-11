import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/subscriptions/create-checkout'

export const Route = createFileRoute('/api/subscriptions/create-checkout')({
    server: { handlers: { GET, POST } },
})
