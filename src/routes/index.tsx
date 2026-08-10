import { createFileRoute } from '@tanstack/react-router'

// Placeholder route: replaced by a redirect to /dashboard once the dashboard
// slice is ported.
export const Route = createFileRoute('/')({
    component: Home,
})

function Home() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background">
            <h1 className="text-2xl font-semibold text-foreground">Evolution Combatives Admin</h1>
            <p className="text-muted-foreground">TanStack Start migration in progress.</p>
        </div>
    )
}
