/**
 * Evolution Combatives - TanStack Start instance
 *
 * Global request middleware, ported from the Next.js middleware.ts:
 * security headers, CSRF protection, rate limiting, and session/role
 * guards for admin page routes. API routes authenticate themselves via
 * validateApiAuthWithSession, so the auth guard only covers page routes.
 */

import { createMiddleware, createStart } from '@tanstack/react-start'
import { createMiddlewareClient } from './lib/supabase'
import { csrfProtection } from './lib/csrf-protection'
import { checkRateLimit, getClientIP, rateLimitResponse } from './lib/rate-limit'
import { isSecureRequest } from './lib/csrf-protection'
import type { AdminRole } from 'shared/types/database'

// Route configuration
const ROUTE_CONFIG = {
    // Public routes that don't require authentication
    public: [
        '/',
        '/login',
        '/sign-up',
        '/forgot-password',
        '/reset-password',
        '/auth/confirm',
        '/subscribe',
        '/subscription-success',
        '/subscription-cancel',
        '/health',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
        '/.well-known*',
        '/assets*',
        '/ingest*'
    ],

    // Role-based route access
    roleAccess: {
        super_admin: [
            '/dashboard',
            '/users',
            '/analytics',
            '/qa',
            '/subscribe'
        ],
        content_admin: [
            '/dashboard',
            '/analytics'
        ],
        support_admin: [
            '/dashboard',
            '/users',
            '/qa'
        ]
    }
} as const

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours

function isPublicRoute(pathname: string): boolean {
    return ROUTE_CONFIG.public.some(route => {
        if (route === pathname) return true
        if (route.endsWith('*')) {
            const prefix = route.slice(0, -1)
            return pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix)
        }
        return false
    })
}

function hasRouteAccess(pathname: string, role: AdminRole): boolean {
    if (role === 'super_admin') {
        return true
    }

    const allowedRoutes = ROUTE_CONFIG.roleAccess[role] ?? []

    return allowedRoutes.some(route => {
        if (route === pathname) return true
        if (pathname.startsWith(route + '/')) return true
        return false
    })
}

// Note: not Response.redirect() — its headers are immutable, and the auth
// guard appends refreshed session cookies to redirects.
function redirect(request: Request, to: string): Response {
    return new Response(null, {
        status: 302,
        headers: { Location: new URL(to, request.url).toString() },
    })
}

/** Schedule background work past the response (waitUntil on Workers). */
async function runInBackground(work: () => Promise<unknown>): Promise<void> {
    try {
        const { waitUntil } = await import(/* @vite-ignore */ 'cloudflare:workers')
        waitUntil(work())
    } catch {
        void work()
    }
}

/** Normalize a middleware result so headers can be appended to either shape. */
function resultResponse(result: unknown): Response | undefined {
    if (result instanceof Response) return result
    if (result && typeof result === 'object' && 'response' in result) {
        return (result as { response?: Response }).response
    }
    return undefined
}

/**
 * Outermost middleware: security headers on every response.
 */
const securityHeadersMiddleware = createMiddleware({ type: 'request' }).server(
    async ({ request, next }) => {
        const result = await next()
        const response = resultResponse(result)

        if (response) {
            response.headers.set('X-Frame-Options', 'DENY')
            response.headers.set('X-Content-Type-Options', 'nosniff')
            response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
            response.headers.set('X-XSS-Protection', '1; mode=block')

            const csp = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https: blob:",
                "media-src 'self' https: blob:",
                "connect-src 'self' https: wss:",
                "frame-src 'self' https://*.cloudflarestream.com https://iframe.videodelivery.net",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'"
            ].join('; ')
            response.headers.set('Content-Security-Policy', csp)

            if (isSecureRequest(request)) {
                response.headers.set(
                    'Strict-Transport-Security',
                    'max-age=31536000; includeSubDomains; preload'
                )
            }
        }

        return result
    },
)

/**
 * CSRF protection for state-changing API requests (double-submit cookie).
 * Webhooks and Bearer-authenticated mobile routes are exempt.
 */
const csrfMiddleware = createMiddleware({ type: 'request' }).server(
    async ({ request, next }) => {
        const csrfError = csrfProtection(request)
        if (csrfError) {
            return csrfError
        }
        return next()
    },
)

/**
 * Rate limiting for API routes and login attempts.
 */
const rateLimitMiddleware = createMiddleware({ type: 'request' }).server(
    async ({ request, next }) => {
        const pathname = new URL(request.url).pathname
        const clientIP = getClientIP(request)

        if (pathname.startsWith('/api/')) {
            const kind = pathname.startsWith('/api/admin/') ? 'admin' : 'api'
            const allowed = await checkRateLimit(kind, `${clientIP}:${kind}`)
            if (!allowed) {
                return rateLimitResponse()
            }
        }

        if ((pathname === '/api/auth/login' || pathname === '/api/auth/sign-up') && request.method === 'POST') {
            const allowed = await checkRateLimit('auth', clientIP)
            if (!allowed) {
                return rateLimitResponse()
            }
        }

        return next()
    },
)

/**
 * Session + role guard for admin page routes. API routes are skipped —
 * they authenticate themselves from cookies via validateApiAuthWithSession.
 */
const authGuardMiddleware = createMiddleware({ type: 'request' }).server(
    async ({ request, next }) => {
        const pathname = new URL(request.url).pathname

        if (pathname.startsWith('/api/') || isPublicRoute(pathname)) {
            return next()
        }

        // Only guard document/page navigation paths
        const { supabase, cookieHeaders } = createMiddlewareClient(request)

        /** Merge any refreshed auth cookies into the outgoing response. */
        const withAuthCookies = <T,>(result: T): T => {
            const response = resultResponse(result)
            if (response) {
                for (const value of cookieHeaders.getSetCookie()) {
                    response.headers.append('Set-Cookie', value)
                }
            }
            return result
        }

        const withCookiesOnRedirect = (response: Response) => {
            for (const value of cookieHeaders.getSetCookie()) {
                response.headers.append('Set-Cookie', value)
            }
            return response
        }

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError || !user) {
                const loginUrl = new URL('/login', request.url)
                loginUrl.searchParams.set('redirectTo', pathname)
                return withCookiesOnRedirect(
                    new Response(null, { status: 302, headers: { Location: loginUrl.toString() } }),
                )
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('admin_role, full_name, last_login_at')
                .eq('id', user.id)
                .single()

            if (profileError || !profile) {
                return withCookiesOnRedirect(redirect(request, '/login?error=profile_error'))
            }

            if (!profile.admin_role) {
                return withCookiesOnRedirect(redirect(request, '/login?error=access_denied'))
            }

            if (!hasRouteAccess(pathname, profile.admin_role as AdminRole)) {
                return withCookiesOnRedirect(redirect(request, '/dashboard?error=insufficient_permissions'))
            }

            // Session timeout based on last login
            if (profile.last_login_at) {
                const lastLoginTime = new Date(profile.last_login_at).getTime()
                if (Date.now() - lastLoginTime > SESSION_TIMEOUT_MS) {
                    try {
                        await supabase.auth.signOut()
                    } catch {
                        // best-effort sign-out of the expired session
                    }
                    return withCookiesOnRedirect(redirect(request, '/login?error=session_expired'))
                }
            }

            // Update last activity past the response lifecycle
            await runInBackground(async () => {
                await supabase
                    .from('profiles')
                    .update({ last_activity_at: new Date().toISOString() })
                    .eq('id', user.id)
            })

            return withAuthCookies(await next())
        } catch (error) {
            console.error('Auth guard middleware error:', error)
            return redirect(request, '/login?error=middleware_error')
        }
    },
)

export const startInstance = createStart(() => {
    return {
        requestMiddleware: [
            securityHeadersMiddleware,
            csrfMiddleware,
            rateLimitMiddleware,
            authGuardMiddleware,
        ],
    }
})
