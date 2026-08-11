/**
 * CSRF Protection utility for API routes
 * Provides token generation and validation for state-changing operations
 * (double-submit cookie pattern over the Web Request API)
 */

const CSRF_TOKEN_HEADER = 'X-CSRF-Token'

/**
 * Use a host-only Secure cookie for HTTPS and a regular cookie for local HTTP.
 */
export function isSecureRequest(request: Request): boolean {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    return forwardedProtocol ? forwardedProtocol === 'https' : new URL(request.url).protocol === 'https:'
}

export function getCSRFCookieName(request: Request): string {
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

function getCookieValue(request: Request, name: string): string | undefined {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return undefined

    for (const part of cookieHeader.split(';')) {
        const [rawName, ...rest] = part.trim().split('=')
        if (rawName === name) {
            return decodeURIComponent(rest.join('='))
        }
    }
    return undefined
}

/**
 * Validate CSRF token for API requests
 */
export function validateCSRFToken(request: Request): boolean {
    try {
        const tokenFromHeader = request.headers.get(CSRF_TOKEN_HEADER)
        const tokenFromCookie = getCookieValue(request, getCSRFCookieName(request))

        if (!tokenFromHeader || !tokenFromCookie) {
            return false
        }

        return tokenFromHeader === tokenFromCookie && tokenFromHeader.length === 64
    } catch {
        return false
    }
}

/**
 * Check if request needs CSRF protection (state-changing operations)
 */
export function needsCSRFProtection(request: Request): boolean {
    const method = request.method.toUpperCase()
    const pathname = new URL(request.url).pathname
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const isApiRoute = pathname.startsWith('/api/')
    const isWebhook = pathname.includes('/webhook')
    const isMobileApi = pathname.startsWith('/api/mobile/')

    // Skip CSRF for webhooks (they have their own verification) and mobile API routes (use Bearer auth)
    return isStateChanging && isApiRoute && !isWebhook && !isMobileApi
}

/**
 * Middleware function to validate CSRF for protected routes.
 * Returns a 403 response when validation fails, or null to continue.
 */
export function csrfProtection(request: Request): Response | null {
    if (!needsCSRFProtection(request)) {
        return null
    }

    if (!validateCSRFToken(request)) {
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
