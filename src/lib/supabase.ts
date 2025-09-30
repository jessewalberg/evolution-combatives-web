/**
 * Evolution Combatives - Next.js Supabase Clients
 *
 * @description This file initializes various Supabase clients for the Next.js admin app,
 * using shared configurations and services. It provides factories for creating
 * services in different contexts (browser, server, admin).
 *
 * @author Evolution Combatives
 */

import { createClientComponentClient, createServerComponentClient as createSupabaseServerClient, createMiddlewareClient as createSupabaseMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'

// Client-side (browser)
export const createBrowserClient = () =>
    createClientComponentClient()

// Server-side (SSR/API routes)
export const createServerClient = async () => {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return createSupabaseServerClient({ cookies: () => cookieStore })
}

// Export for backward compatibility
export const createServerComponentClient = async () => {
    const { cookies } = await import('next/headers')
    return createSupabaseServerClient({ cookies })
}

// Admin client (service role) for privileged operations
export const createAdminClient = () => {
    // Prevent usage in browser environment for security
    if (typeof window !== 'undefined') {
        throw new Error('createAdminClient cannot be used in browser environment - use server-side API routes instead')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

// Middleware client for Next.js middleware
export const createMiddlewareClient = (req: NextRequest, res: NextResponse) =>
    createSupabaseMiddlewareClient({ req, res })

// Export client creation functions that some components expect  
export { createClientComponentClient }