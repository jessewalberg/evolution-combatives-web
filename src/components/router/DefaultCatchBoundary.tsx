import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
    const router = useRouter()
    const isRoot = useMatch({
        strict: false,
        select: (state) => state.id === rootRouteId,
    })

    console.error('DefaultCatchBoundary error:', error)

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
            <ErrorComponent error={error} />
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => void router.invalidate()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                    Try again
                </button>
                {isRoot ? (
                    <Link
                        to="/"
                        className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                    >
                        Home
                    </Link>
                ) : (
                    <Link
                        to="/"
                        className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                        onClick={(e) => {
                            e.preventDefault()
                            window.history.back()
                        }}
                    >
                        Go back
                    </Link>
                )}
            </div>
        </div>
    )
}
