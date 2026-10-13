import { createFileRoute } from '@tanstack/react-router'
import { DELETE, GET, POST, PUT } from '@/src/server/webhooks/cloudflare'

export const Route = createFileRoute('/api/webhooks/cloudflare')({
    server: { handlers: { DELETE, GET, POST, PUT } },
})
