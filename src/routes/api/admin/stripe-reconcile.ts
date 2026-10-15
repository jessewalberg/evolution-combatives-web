import { createFileRoute } from '@tanstack/react-router'
import { GET, POST } from '@/src/server/admin/stripe-reconcile'

export const Route = createFileRoute('/api/admin/stripe-reconcile')({
    server: { handlers: { GET, POST } },
})
