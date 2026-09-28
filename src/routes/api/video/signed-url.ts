import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/video/signed-url'

export const Route = createFileRoute('/api/video/signed-url')({
    server: { handlers: { POST } },
})
