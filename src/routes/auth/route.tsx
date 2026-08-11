import { createFileRoute, Outlet } from '@tanstack/react-router'

function AuthLayout() {
    return (
        <div className="min-h-screen bg-neutral-900">
            <Outlet />
        </div>
    )
}

export const Route = createFileRoute('/auth')({
    component: AuthLayout,
})
