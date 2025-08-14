import { NextResponse } from 'next/server'
import { generateCSRFToken } from '../../../src/lib/csrf-protection'

export async function GET() {
    try {
        const token = generateCSRFToken()
        
        const response = NextResponse.json({ 
            success: true, 
            csrfToken: token 
        })

        // Set secure cookie with CSRF token
        response.cookies.set('__Host-csrf-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 // 24 hours
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