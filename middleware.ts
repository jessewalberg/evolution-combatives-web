/**
 * Evolution Combatives - Next.js Middleware
 * Route protection and security middleware for admin dashboard
 * 
 * @description Handles authentication, authorization, and security for admin routes
 * @author Evolution Combatives
 */

import { createMiddlewareClient } from './src/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AdminRole } from 'shared/types/database'
import { csrfProtection } from './src/lib/csrf-protection'

// Route configuration
const ROUTE_CONFIG = {
    // Public routes that don't require authentication
    public: [
        '/',
        '/login',
        '/forgot-password',
        '/reset-password',
        '/auth/confirm',
        '/subscribe',
        '/subscription-success',
        '/subscription-cancel',
        '/health',
        '/api/health',
        '/api/auth/login',
        '/api/auth/logout',
        '/api/csrf-token',
        '/api/subscriptions/create-checkout',
        '/api/webhooks/stripe',
        '/api/webhooks/cloudflare',
        '/.well-known*',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
        '/_next/static*',
        '/_next/image*',
        '/public*'
    ],

    // Protected routes that require authentication
    protected: [
        '/dashboard'
    ],

    // Role-based route access
    roleAccess: {
        super_admin: [
            '/dashboard',
            '/users',
            '/analytics',
            '/qa',
            '/subscribe',
            '/api/admin',
            '/api/content',
            '/api/cloudflare',
            '/api/support'
        ],
        content_admin: [
            '/dashboard',
            '/analytics',
            '/api/content',
            '/api/cloudflare'
        ],
        support_admin: [
            '/dashboard',
            '/users',
            '/qa',
            '/api/support'
        ]
    }
} as const

// Rate limiting configuration
const RATE_LIMITS = {
    api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000 // Dramatically increased for development
    },
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100 // Dramatically increased
    },
    admin: {
        windowMs: 5 * 60 * 1000, // 5 minutes  
        maxRequests: 500 // Dramatically increased
    }
} as const

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Rate limiting helper
 */
function checkRateLimit(
    identifier: string,
    config: { windowMs: number; maxRequests: number }
): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const key = identifier
    const window = rateLimitStore.get(key)

    // Clean expired entries periodically
    if (Math.random() < 0.1) {
        for (const [k, v] of rateLimitStore.entries()) {
            if (now > v.resetTime) {
                rateLimitStore.delete(k)
            }
        }
    }

    if (!window || now > window.resetTime) {
        // New window
        const resetTime = now + config.windowMs
        rateLimitStore.set(key, { count: 1, resetTime })
        return { allowed: true, remaining: config.maxRequests - 1, resetTime }
    }

    if (window.count >= config.maxRequests) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetTime: window.resetTime }
    }

    // Increment counter
    window.count++
    rateLimitStore.set(key, window)
    return {
        allowed: true,
        remaining: config.maxRequests - window.count,
        resetTime: window.resetTime
    }
}

/**
 * Check if route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
    return ROUTE_CONFIG.public.some(route => {
        if (route === pathname) return true
        if (route.endsWith('*')) {
            return pathname.startsWith(route.slice(0, -1))
        }
        return false
    })
}

/**
 * Check if user has access to specific route based on role
 */
function hasRouteAccess(pathname: string, role: AdminRole): boolean {
    // Super admin has access to everything
    if (role === 'super_admin') {
        return true
    }

    const allowedRoutes = ROUTE_CONFIG.roleAccess[role]

    return allowedRoutes.some(route => {
        // Exact match
        if (route === pathname) return true

        // Prefix match for nested routes
        if (pathname.startsWith(route + '/')) return true

        return false
    })
}

/**
 * Get client IP address for rate limiting
 */
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')

    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }

    if (realIP) {
        return realIP
    }

    return 'unknown'
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
    // Security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')

    // Content Security Policy for admin dashboard
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "media-src 'self' https:",
        "connect-src 'self' https: wss:",
        "frame-src 'self' https://*.cloudflarestream.com https://iframe.videodelivery.net",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)

    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        )
    }

    return response
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const clientIP = getClientIP(request)

    try {
        // Create response
        let response = NextResponse.next()

        // Add security headers to all responses
        response = addSecurityHeaders(response)

        // CSRF protection for state-changing API requests
        const csrfError = await csrfProtection(request)
        if (csrfError) {
            return csrfError
        }

        // Rate limiting for API routes
        if (pathname.startsWith('/api/')) {
            // Different rate limits for admin vs regular API routes
            const rateLimitConfig = pathname.startsWith('/api/admin/')
                ? RATE_LIMITS.admin
                : RATE_LIMITS.api

            const rateLimit = checkRateLimit(`api:${clientIP}:${pathname.startsWith('/api/admin/') ? 'admin' : 'general'}`, rateLimitConfig)

            // Add rate limit headers
            response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString())
            response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
            response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())

            if (!rateLimit.allowed) {
                return new NextResponse(
                    JSON.stringify({
                        error: 'Rate limit exceeded',
                        message: 'Too many requests. Please try again later.'
                    }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
                        }
                    }
                )
            }
        }

        // Rate limiting for auth routes
        if (pathname === '/login' && request.method === 'POST') {
            const rateLimit = checkRateLimit(`auth:${clientIP}`, RATE_LIMITS.auth)

            if (!rateLimit.allowed) {
                return NextResponse.redirect(
                    new URL(`/login?error=rate_limit&retry_after=${rateLimit.resetTime}`, request.url)
                )
            }
        }

        // Skip auth check for public routes
        if (isPublicRoute(pathname)) {
            return response
        }

        // Create Supabase client for middleware
        const supabase = createMiddlewareClient(request, response)

        // Get session with automatic token refresh
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) {
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.error('Middleware session error:', sessionError)
            }

            // For API routes, let them handle authentication themselves
            if (pathname.startsWith('/api/')) {
                return response
            }

            return NextResponse.redirect(new URL('/login?error=session_error', request.url))
        }

        // Handle missing session differently for API routes vs page routes
        if (!session) {
            // For API routes, let them handle authentication themselves
            if (pathname.startsWith('/api/')) {
                return response
            }

            // For page routes, redirect to login
            const loginUrl = new URL('/login', request.url)
            loginUrl.searchParams.set('redirectTo', pathname)
            return NextResponse.redirect(loginUrl)
        }

        // Get user profile with admin role (with caching)
        const cacheKey = `profile:${session.user.id}`
        type ProfileData = { admin_role: string; full_name: string; last_login_at: string }
        let profile: ProfileData | null = null

        // Simple in-memory cache (in production, use Redis)
        const profileCache = new Map<string, { data: ProfileData; expires: number }>()
        const cached = profileCache.get(cacheKey)

        if (cached && Date.now() < cached.expires) {
            profile = cached.data
        } else {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('admin_role, full_name, last_login_at')
                .eq('id', session.user.id)
                .single()

            if (profileError || !profileData) {
                if (process.env.NODE_ENV === 'development') {
                    // eslint-disable-next-line no-console
                    console.error('Middleware profile error:', profileError)
                }
                return NextResponse.redirect(new URL('/login?error=profile_error', request.url))
            }

            profile = profileData


            // Cache for 5 minutes
            profileCache.set(cacheKey, {
                data: profile,
                expires: Date.now() + 5 * 60 * 1000
            })
        }


        // Check if user has admin role
        if (!profile.admin_role) {
            return NextResponse.redirect(new URL('/login?error=access_denied', request.url))
        }

        // Check role-based route access (skip for API routes - they handle their own auth)
        if (!pathname.startsWith('/api/') && !hasRouteAccess(pathname, profile.admin_role as AdminRole)) {
            if (process.env.NODE_ENV === 'development') {
                console.log('Route access denied:', {
                    pathname,
                    role: profile.admin_role,
                    allowedRoutes: ROUTE_CONFIG.roleAccess[profile.admin_role as AdminRole]
                })
            }
            return NextResponse.redirect(new URL('/dashboard?error=insufficient_permissions', request.url))
        }

        // Add user info to request headers for pages/API routes
        response.headers.set('X-User-ID', session.user.id)
        response.headers.set('X-User-Role', profile.admin_role)
        response.headers.set('X-User-Email', session.user.email || '')

        // Update last activity timestamp (throttled to prevent too many updates)
        const lastActivityKey = `activity:${session.user.id}`
        const lastActivity = profileCache.get(lastActivityKey)

        if (!lastActivity || Date.now() - lastActivity.expires > 5 * 60 * 1000) {
            // Update in background (don't await)
            const updateActivity = async () => {
                try {
                    await supabase
                        .from('profiles')
                        .update({ last_activity_at: new Date().toISOString() })
                        .eq('id', session.user.id)

                    profileCache.set(lastActivityKey, {
                        data: profile,
                        expires: Date.now() + 5 * 60 * 1000
                    })
                } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                        // eslint-disable-next-line no-console
                        console.error('Failed to update last activity:', error)
                    }
                }
            }

            // Execute in background
            updateActivity()
        }

        // Check for session timeout based on last activity
        if (profile.last_login_at) {
            const lastLoginTime = new Date(profile.last_login_at).getTime()
            const sessionTimeoutMs = 24 * 60 * 60 * 1000 // 24 hours

            if (Date.now() - lastLoginTime > sessionTimeoutMs) {
                // Session expired - sign out user
                try {
                    await supabase.auth.signOut()
                } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                        // eslint-disable-next-line no-console
                        console.error('Failed to sign out expired session:', error)
                    }
                }

                return NextResponse.redirect(new URL('/login?error=session_expired', request.url))
            }
        }

        return response

    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.error('Middleware error:', error)
        }

        // Fallback to login on any unexpected error
        return NextResponse.redirect(new URL('/login?error=middleware_error', request.url))
    }
}

/**
 * Middleware configuration
 * Specify which routes should be processed by this middleware
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         * - vercel analytics/speed insights
         * - external scripts and assets
         */
        '/((?!_next/static|_next/image|favicon.ico|public/|_vercel|ingest/).*)',
    ],
} 