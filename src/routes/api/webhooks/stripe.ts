import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/webhooks/stripe'

export const Route = createFileRoute('/api/webhooks/stripe')({
    server: { handlers: { GET, POST } },
})
