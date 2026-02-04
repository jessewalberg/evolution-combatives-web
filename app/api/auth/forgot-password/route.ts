/**
 * Evolution Combatives - Forgot Password API Route
 * Handles admin password reset requests
 *
 * @description Secure API endpoint for admin password reset with rate limiting and validation
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '../../../../src/lib/supabase'

// Request validation schema
const forgotPasswordRequestSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim())
})

// Rate limiting storage (in production, use Redis)
const resetAttempts = new Map<string, { count: number; resetTime: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

/**
 * Rate limiting helper
 */
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const attempts = resetAttempts.get(identifier)

    // Clean expired entries periodically
    if (Math.random() < 0.1) {
        for (const [key, value] of resetAttempts.entries()) {
            if (now > value.resetTime) {
                resetAttempts.delete(key)
            }
        }
    }

    if (!attempts || now > attempts.resetTime) {
        // New window
        const resetTime = now + LOCKOUT_DURATION
        resetAttempts.set(identifier, { count: 1, resetTime })
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetTime }
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetTime: attempts.resetTime }
    }

    // Increment counter
    attempts.count++
    resetAttempts.set(identifier, attempts)
    return {
        allowed: true,
        remaining: MAX_ATTEMPTS - attempts.count,
        resetTime: attempts.resetTime
    }
}

/**
 * Get client IP for rate limiting
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
 * POST /api/auth/forgot-password
 * Send password reset email (admin only)
 */
export async function POST(request: NextRequest) {
    try {
        const clientIP = getClientIP(request)
        const rateLimitKey = `forgot-password:${clientIP}`

        // Check rate limiting
        const rateLimit = checkRateLimit(rateLimitKey)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Too many requests',
                    message: 'Too many password reset requests. Please try again later.',
                    retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': MAX_ATTEMPTS.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
                        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
                    }
                }
            )
        }

        // Parse and validate request body
        const body = await request.json()
        const validatedData = forgotPasswordRequestSchema.parse(body)

        // Create Supabase admin client (service role)
        const supabase = createAdminClient()

        // Check if user exists and has admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('admin_role')
            .eq('email', validatedData.email)
            .single()

        if (!profileError && profile?.admin_role) {
            // Send password reset email for admins only
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                validatedData.email,
                {
                    redirectTo: `${request.nextUrl.origin}/reset-password`
                }
            )

            if (resetError && process.env.NODE_ENV === 'development') {
                console.error('Forgot password reset error:', resetError)
            }
        }

        // Always return a generic success response to avoid user enumeration
        const response = NextResponse.json({
            success: true,
            message: 'If an admin account exists with that email, a reset link has been sent.'
        })

        response.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString())
        response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
        response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())

        return response

    } catch (error) {
        // Log error for debugging in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Forgot password API error:', error)
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Validation error',
                    message: 'Invalid request data',
                    details: error.errors
                },
                { status: 400 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                message: 'An unexpected error occurred. Please try again.'
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/auth/forgot-password
 * Return method not allowed for GET requests
 */
export async function GET() {
    return NextResponse.json(
        {
            success: false,
            error: 'Method not allowed',
            message: 'This endpoint only accepts POST requests'
        },
        {
            status: 405,
            headers: {
                'Allow': 'POST'
            }
        }
    )
}

/**
 * Handle other HTTP methods
 */
export async function PUT() {
    return NextResponse.json(
        {
            success: false,
            error: 'Method not allowed',
            message: 'This endpoint only accepts POST requests'
        },
        {
            status: 405,
            headers: {
                'Allow': 'POST'
            }
        }
    )
}

export async function DELETE() {
    return NextResponse.json(
        {
            success: false,
            error: 'Method not allowed',
            message: 'This endpoint only accepts POST requests'
        },
        {
            status: 405,
            headers: {
                'Allow': 'POST'
            }
        }
    )
}

export async function PATCH() {
    return NextResponse.json(
        {
            success: false,
            error: 'Method not allowed',
            message: 'This endpoint only accepts POST requests'
        },
        {
            status: 405,
            headers: {
                'Allow': 'POST'
            }
        }
    )
}
