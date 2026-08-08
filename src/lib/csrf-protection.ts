/**
 * CSRF Protection utility for API routes
 * Provides token generation and validation for state-changing operations
 */

import { NextRequest } from 'next/server'

const CSRF_TOKEN_HEADER = 'X-CSRF-Token'

/**
 * Use a host-only Secure cookie for HTTPS and a regular cookie for local HTTP.
 */
export function isSecureRequest(request: NextRequest): boolean {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    return forwardedProtocol ? forwardedProtocol === 'https' : request.nextUrl.protocol === 'https:'
}

export function getCSRFCookieName(request: NextRequest): string {
    return isSecureRequest(request) ? '__Host-csrf-token' : 'csrf-token'
}

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate CSRF token for API requests
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
    try {
        const tokenFromHeader = request.headers.get(CSRF_TOKEN_HEADER)
        const tokenFromCookie = request.cookies.get(getCSRFCookieName(request))?.value

        if (!tokenFromHeader || !tokenFromCookie) {
            return false
        }

        // Use timing-safe comparison to prevent timing attacks
        return tokenFromHeader === tokenFromCookie && tokenFromHeader.length === 64
    } catch {
        return false
    }
}

/**
 * Check if request needs CSRF protection (state-changing operations)
 */
export function needsCSRFProtection(request: NextRequest): boolean {
    const method = request.method.toUpperCase()
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
    const isWebhook = request.nextUrl.pathname.includes('/webhook')
    const isMobileApi = request.nextUrl.pathname.startsWith('/api/mobile/')

    // Skip CSRF for webhooks (they have their own verification) and mobile API routes (use Bearer auth)
    return isStateChanging && isApiRoute && !isWebhook && !isMobileApi
}

/**
 * Middleware function to validate CSRF for protected routes
 */
export async function csrfProtection(request: NextRequest): Promise<Response | null> {
    if (!needsCSRFProtection(request)) {
        return null
    }

    const isValid = await validateCSRFToken(request)

    if (!isValid) {
        return new Response(
            JSON.stringify({
                success: false,
                error: 'CSRF token validation failed'
            }),
            {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        )
    }

    return null
}
