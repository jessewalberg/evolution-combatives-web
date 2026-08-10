import { Link } from '@tanstack/react-router'

export function NotFound() {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
            <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
            <p className="text-muted-foreground">
                The page you are looking for does not exist or has been moved.
            </p>
            <Link
                to="/"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
                Back to home
            </Link>
        </div>
    )
}
