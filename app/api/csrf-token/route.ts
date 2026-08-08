import { NextRequest, NextResponse } from 'next/server'
import {
    generateCSRFToken,
    getCSRFCookieName,
    isSecureRequest
} from '../../../src/lib/csrf-protection'

export async function GET(request: NextRequest) {
    try {
        const token = generateCSRFToken()
        const maxAge = 60 * 60 * 24 // 24 hours in seconds
        const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()

        const response = NextResponse.json({
            success: true,
            csrfToken: token,
            expiresAt
        })

        // Match cookie security to the effective transport protocol.
        response.cookies.set(getCSRFCookieName(request), token, {
            httpOnly: true,
            secure: isSecureRequest(request),
            sameSite: 'strict',
            path: '/',
            maxAge
        })

        return response
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to generate CSRF token'
            },
            { status: 500 }
        )
    }
}
