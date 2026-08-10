import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/cloudflare/upload'

export const Route = createFileRoute('/api/cloudflare/upload')({
    server: { handlers: { POST } },
})
