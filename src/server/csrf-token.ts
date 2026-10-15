/**
 * CSRF token issuance endpoint (double-submit cookie pattern). The token is
 * returned in the body for the client to echo in X-CSRF-Token, and set as a
 * cookie for the server-side comparison.
 */

import { generateCSRFToken, getCSRFCookieName, isSecureRequest } from '@/src/lib/csrf-protection'
import { json } from '@/src/lib/http'

export async function GET({ request }: { request: Request }) {
    try {
        const token = generateCSRFToken()
        const maxAge = 60 * 60 * 24 // 24 hours in seconds
        const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()

        const { setCookie } = await import('@tanstack/react-start/server')

        // Match cookie security to the effective transport protocol.
        setCookie(getCSRFCookieName(request), token, {
            httpOnly: true,
            secure: isSecureRequest(request),
            sameSite: 'strict',
            path: '/',
            maxAge
        })

        return json({
            success: true,
            csrfToken: token,
            expiresAt
        })
    } catch {
        return json(
            {
                success: false,
                error: 'Failed to generate CSRF token'
            },
            { status: 500 }
        )
    }
}
