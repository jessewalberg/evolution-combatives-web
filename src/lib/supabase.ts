/**
 * Evolution Combatives - Supabase Clients (TanStack Start / Cloudflare Workers)
 *
 * @description Factories for the Supabase clients used in each context:
 * browser, server (server routes / server functions), request middleware,
 * and privileged admin (service role).
 *
 * @author Evolution Combatives
 */

import {
    createBrowserClient as createSSRBrowserClient,
    createServerClient as createSSRServerClient,
    parseCookieHeader,
    serializeCookieHeader,
} from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './shared/types/database'

/**
 * Resolve the Supabase URL/anon key for the current context. On the client
 * these are inlined VITE_* values; on the Worker they come from wrangler
 * vars via process.env (nodejs_compat populates it).
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
    const processEnv = typeof process !== 'undefined' ? process.env : undefined
    const url = import.meta.env.VITE_SUPABASE_URL || processEnv?.SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || processEnv?.SUPABASE_ANON_KEY

    if (!url || !anonKey) {
        throw new Error('Supabase environment variables are not configured (SUPABASE_URL / SUPABASE_ANON_KEY)')
    }

    return { url, anonKey }
}

let browserClient: SupabaseClient<Database> | undefined

// Client-side (browser). Singleton so all components share one auth state.
export const createBrowserClient = (): SupabaseClient<Database> => {
    const { url, anonKey } = getSupabaseConfig()

    if (typeof window === 'undefined') {
        // SSR render path: no persistent session, cookies are handled by the
        // server client. A throwaway client keeps component code isomorphic.
        return createSSRBrowserClient<Database>(url, anonKey)
    }

    if (!browserClient) {
        browserClient = createSSRBrowserClient<Database>(url, anonKey)
    }

    return browserClient
}

// Backward-compatible alias for legacy call sites.
export const createClientComponentClient = createBrowserClient

/**
 * Server-side client for server routes and server functions. Reads and
 * writes auth cookies through TanStack Start's request context, so it must
 * only be called while handling a request.
 */
export const createServerClient = async () => {
    const { url, anonKey } = getSupabaseConfig()
    const { getCookies, setCookie } = await import('@tanstack/react-start/server')

    return createSSRServerClient(url, anonKey, {
        cookies: {
            getAll: () =>
                Object.entries(getCookies() ?? {}).map(([name, value]) => ({
                    name,
                    value: value ?? '',
                })),
            setAll: (cookiesToSet) => {
                for (const { name, value, options } of cookiesToSet) {
                    setCookie(name, value, options)
                }
            },
        },
    })
}

// Backward-compatible alias for legacy call sites.
export const createServerComponentClient = createServerClient

/**
 * Client for global request middleware, where the Start request context is
 * not yet established. Cookie writes (session refreshes) accumulate on
 * `cookieHeaders`; the middleware merges them into the outgoing response.
 */
export const createMiddlewareClient = (request: Request) => {
    const { url, anonKey } = getSupabaseConfig()
    const cookieHeaders = new Headers()

    const supabase = createSSRServerClient(url, anonKey, {
        cookies: {
            getAll: () =>
                parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
                    name,
                    value: value ?? '',
                })),
            setAll: (cookiesToSet) => {
                for (const { name, value, options } of cookiesToSet) {
                    cookieHeaders.append('Set-Cookie', serializeCookieHeader(name, value, options))
                }
            },
        },
    })

    return { supabase, cookieHeaders }
}

// Admin client (service role) for privileged operations
export const createAdminClient = () => {
    // Prevent usage in browser environment for security
    if (typeof window !== 'undefined') {
        throw new Error('createAdminClient cannot be used in browser environment - use server-side API routes instead')
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    }

    const { url } = getSupabaseConfig()

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
