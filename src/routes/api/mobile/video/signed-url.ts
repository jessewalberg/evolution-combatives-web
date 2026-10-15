import { createFileRoute } from '@tanstack/react-router'
import { POST } from '@/src/server/mobile/video-signed-url'

export const Route = createFileRoute('/api/mobile/video/signed-url')({
    server: { handlers: { POST } },
})
