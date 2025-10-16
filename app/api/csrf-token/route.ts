import { NextResponse } from 'next/server'
import { generateCSRFToken } from '../../../src/lib/csrf-protection'

export async function GET() {
    try {
        const token = generateCSRFToken()
        const maxAge = 60 * 60 * 24 // 24 hours in seconds
        const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()

        const response = NextResponse.json({
            success: true,
            csrfToken: token,
            expiresAt
        })

        // Set secure cookie with CSRF token
        const cookieName = process.env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf-token'
        response.cookies.set(cookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
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