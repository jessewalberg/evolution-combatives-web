/**
 * Evolution Combatives - Users Layout
 * Layout wrapper for users pages with admin navigation
 * 
 * @description Provides consistent admin layout with authentication for user management
 * @author Evolution Combatives
 */

'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../../src/hooks/useAuth'
import AdminLayout from '../../src/components/layout/admin-layout'
import { toast } from 'sonner'
import { Spinner } from '../../src/components/ui/loading'

interface UsersLayoutProps {
    children: React.ReactNode
}

export default function UsersLayout({ children }: UsersLayoutProps) {
    const router = useRouter()
    const { user, profile, isLoading, logout } = useAuth()

    const handleLogout = async () => {
        try {
            // Clear any local storage items before logout
            localStorage.removeItem('admin_remember_me')

            // Use the logout function from useAuth hook
            await logout()

            toast.success('Logged out successfully', {
                description: 'You have been securely logged out.'
            })
        } catch (error) {
            console.error('Logout error:', error)
            toast.error('Logout failed', {
                description: 'An unexpected error occurred during logout.'
            })
        }
    }

    const handleUserAction = (action: string) => {
        switch (action) {
            case 'logout':
                handleLogout()
                break
            case 'profile':
                router.push('/users/profile')
                break
            case 'edit':
                router.push('/users/profile/edit')
                break
            case 'password':
                router.push('/users/profile/change-password')
                break
            default:
                console.log('Unhandled user action:', action)
        }
    }

    const handleSearch = (query: string) => {
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query)}`)
        }
    }

    // Show loading spinner while checking authentication
    if (isLoading || !user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Spinner size="lg" />
                    <p className="text-muted-foreground mt-4">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    // Show access denied if user doesn't have admin role
    if (!profile?.admin_role) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground mb-4">
                        Access Denied
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        Your account does not have admin permissions to access this dashboard.
                    </p>
                    <div className="space-y-4">
                        <button
                            onClick={handleLogout}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
                        >
                            Sign Out
                        </button>
                        <p className="text-xs text-muted-foreground">
                            Current role: {profile?.admin_role || 'none'} | User: {user.email}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <AdminLayout
            userRole={profile.admin_role as 'super_admin' | 'content_admin' | 'support_admin'}
            user={{
                name: profile.full_name || user.email || 'Admin User',
                email: user.email || '',
                role: profile.admin_role.replace('_', ' ').toUpperCase(),
                avatar: profile.avatar_url || undefined
            }}
            breadcrumbs={[
                { name: 'Users', href: '/users' }
            ]}
            systemStatus={{
                database: 'online',
                api: 'online',
                cdn: 'online'
            }}
            notificationCount={0}
            onSearch={handleSearch}
            onUserAction={handleUserAction}
        >
            {children}
        </AdminLayout>
    )
}
