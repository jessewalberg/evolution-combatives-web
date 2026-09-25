/**
 * Evolution Combatives - Next.js Supabase Clients
 *
 * @description This file initializes Supabase clients for browser, server,
 * middleware, and privileged admin contexts.
 *
 * @author Evolution Combatives
 */

import {
    createBrowserClient as createSupabaseBrowserClient,
    createServerClient as createSupabaseServerClient,
} from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './shared/types/database'

const getPublicSupabaseConfig = () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
})

// Compatibility name retained for existing client-component callers.
export const createClientComponentClient = () => {
    const { url, anonKey } = getPublicSupabaseConfig()
    return createSupabaseBrowserClient<Database>(url, anonKey)
}

// Client-side (browser)
export const createBrowserClient = createClientComponentClient

const createServerSupabaseClient = async () => {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const { url, anonKey } = getPublicSupabaseConfig()

    return createSupabaseServerClient<Database>(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                    })
                } catch {
                    // Server Components cannot write cookies. Middleware refreshes
                    // auth sessions before those components execute.
                }
            },
        },
    })
}

// Server-side (SSR/API routes)
export const createServerClient = createServerSupabaseClient

// Compatibility name retained for existing Server Component callers.
export const createServerComponentClient = createServerSupabaseClient

// Admin client (service role) for privileged operations
export const createAdminClient = () => {
    // Prevent usage in browser environment for security
    if (typeof window !== 'undefined') {
        throw new Error('createAdminClient cannot be used in browser environment - use server-side API routes instead')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    }

    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

type MiddlewareResponseHandler = (response: NextResponse) => void

function copyResponseState(source: NextResponse, target: NextResponse) {
    source.headers.forEach((value, key) => {
        const normalizedKey = key.toLowerCase()

        if (
            normalizedKey === 'set-cookie' ||
            normalizedKey === 'x-middleware-next' ||
            normalizedKey === 'x-middleware-override-headers' ||
            normalizedKey.startsWith('x-middleware-request-')
        ) {
            return
        }

        target.headers.set(key, value)
    })

    source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
}

/**
 * Creates the middleware Supabase client.
 *
 * Supabase may refresh auth cookies while validating the user. Next.js needs a
 * replacement response constructed from the updated request for those cookies
 * to be visible to the rest of the current request. The optional callback lets
 * middleware retain that replacement while preserving the existing return API.
 */
export const createMiddlewareClient = (
    request: NextRequest,
    response: NextResponse,
    onResponseChange?: MiddlewareResponseHandler
) => {
    const { url, anonKey } = getPublicSupabaseConfig()
    let currentResponse = response

    return createSupabaseServerClient<Database>(url, anonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value)
                })

                // Keep the originally supplied response usable for legacy callers.
                cookiesToSet.forEach(({ name, value, options }) => {
                    currentResponse.cookies.set(name, value, options)
                })

                if (!onResponseChange) {
                    return
                }

                const nextResponse = NextResponse.next({ request })
                copyResponseState(currentResponse, nextResponse)
                currentResponse = nextResponse
                onResponseChange(nextResponse)
            },
        },
    })
}
