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
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfileWithSubscription } from 'shared/types/services'
import type { AdminRole } from 'shared/types/database'

const supabase = createBrowserClient()

const ROLE_PERMISSIONS: Record<NonNullable<AdminRole>, Set<string>> = {
    super_admin: new Set([
        'admin.all',
        'content.read', 'content.write', 'content.delete',
        'users.read', 'users.write', 'users.delete',
        'analytics.read', 'analytics.write',
        'support.read', 'support.write'
    ]),
    content_admin: new Set(['content.read', 'content.write', 'content.delete']),
    support_admin: new Set(['users.read', 'support.read', 'support.write']),
}

export function useAuth() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data: session } = useQuery({
        queryKey: ['auth', 'session'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            return session
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    })

    const { data: profile } = useQuery({
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
    })

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

    return {
        user: session?.user ?? null,
        profile,
        session,
        isAuthenticated: !!session?.user,
        isLoading: false,
        error: null,
        permissions: profile?.admin_role
            ? ROLE_PERMISSIONS[profile.admin_role as NonNullable<AdminRole>] || new Set<string>()
            : new Set<string>(),
        login: loginMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        isLoginLoading: loginMutation.isPending,
        isLogoutLoading: logoutMutation.isPending,
        hasPermission,
    }
}

// Export types and constants
export { ROLE_PERMISSIONS }
export type { AdminRole } 