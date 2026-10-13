import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/mobile/subscriptions-create-checkout'

export const Route = createFileRoute('/api/mobile/subscriptions/create-checkout')({
    server: { handlers: { POST } },
})
