import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Evolution Combatives - Authentication',
    description: 'Email verification and authentication for Evolution Combatives',
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-neutral-900">
            {children}
        </div>
    )
} 