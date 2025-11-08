/**
 * Evolution Combatives - Authentication Hook
 * Refactored auth state management for admin dashboard using shared services
 *
 * @description Authentication hook with TanStack Query, Zustand, and shared services
 * @author Evolution Combatives
 */

'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBrowserClient } from '../lib/supabase-browser'
import { hasAccessToDiscipline } from '../lib/shared/constants/subscriptionTiers'
import type { AdminRole, SubscriptionTier } from 'shared/types/database'

const supabase = createBrowserClient()

const ROLE_PERMISSIONS: Record<NonNullable<AdminRole>, Set<string>> = {
    super_admin: new Set([
        'admin.all',
        'content.read', 'content.write', 'content.delete',
        'users.read', 'users.write', 'users.delete',
        'analytics.read', 'analytics.write',
        'support.read', 'support.write'
    ]),
    content_admin: new Set(['content.read', 'content.write', 'content.delete', 'users.read']),
    support_admin: new Set(['users.read', 'support.read', 'support.write']),
}

export function useAuth() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: session, isLoading: isSessionLoading } = useQuery({
        queryKey: ['auth', 'session'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            return session
        },
        staleTime: 10 * 60 * 1000, // Increased to 10 minutes
        refetchOnWindowFocus: false, // Disabled to prevent excessive requests
        refetchOnMount: false, // Only fetch once per mount
        retry: 1, // Reduce retry attempts
    })

    const { data: profile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['auth', 'profile', session?.user.id],
        queryFn: async () => {
            if (!session?.user.id) return null
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
            return data
        },
        enabled: !!session?.user.id,
        staleTime: 15 * 60 * 1000, // 15 minutes - profile rarely changes
        refetchOnWindowFocus: false,
        retry: 1,
    })

    // Get user's subscription tier (defaults to 'none' if no subscription)
    const { data: subscription } = useQuery({
        queryKey: ['auth', 'subscription', session?.user.id],
        queryFn: async () => {
            if (!session?.user.id) return null
            const { data } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('status', 'active')
                .single()
            return data
        },
        enabled: !!session?.user.id,
        staleTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    })

    // Determine user's subscription tier (defaults to 'none' for free access)
    const userTier = subscription?.tier || 'none'

    const loginMutation = useMutation({
        mutationFn: (credentials: { email: string; password: string }) =>
            supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password
            }),
        onSuccess: async (result) => {
            if (result.error || !result.data) {
                toast.error('Login failed', { description: result.error?.message })
                return
            }
            toast.success('Login successful')
            await queryClient.invalidateQueries({ queryKey: ['auth'] })
            router.push('/dashboard')
        },
    })

    const logoutMutation = useMutation({
        mutationFn: () => supabase.auth.signOut(),
        onSuccess: async (result) => {
            if (result.error) {
                toast.error('Logout failed', { description: result.error.message })
                return
            }
            // Clear auth-related queries
            await queryClient.invalidateQueries({ queryKey: ['auth'] })
            await queryClient.removeQueries({ queryKey: ['auth'] })
            router.push('/login')
        },
    })

    const hasPermission = (permission: string) => {
        const permissions = profile?.admin_role
            ? ROLE_PERMISSIONS[profile.admin_role as NonNullable<AdminRole>] || new Set<string>()
            : new Set<string>()

        if (permissions.has('admin.all')) return true
        return permissions.has(permission)
    }

    // Check if user can access a discipline based on subscription tier
    const canAccessDiscipline = (disciplineRequiredTier: SubscriptionTier) => {
        // Super admins can access everything regardless of subscription
        if (profile?.admin_role === 'super_admin') return true

        return hasAccessToDiscipline(userTier, disciplineRequiredTier)
    }

    return {
        user: session?.user ?? null,
        profile,
        subscription,
        userTier,
        session,
        isAuthenticated: !!session?.user,
        isLoading: isSessionLoading || isProfileLoading,
        error: null,
        permissions: profile?.admin_role
            ? ROLE_PERMISSIONS[profile.admin_role as NonNullable<AdminRole>] || new Set<string>()
            : new Set<string>(),
        login: loginMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        isLoginLoading: loginMutation.isPending,
        isLogoutLoading: logoutMutation.isPending,
        hasPermission,
        canAccessDiscipline,
    }
}

// Export types and constants
export { ROLE_PERMISSIONS }
export type { AdminRole } 