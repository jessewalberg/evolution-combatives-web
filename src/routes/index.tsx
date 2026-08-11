import { createFileRoute, redirect } from '@tanstack/react-router'

// Mirrors the legacy app/page.tsx: '/' immediately redirects to the
// dashboard (the auth guard bounces unauthenticated visitors to /login).
export const Route = createFileRoute('/')({
    beforeLoad: () => {
        throw redirect({ to: '/dashboard' })
    },
})
