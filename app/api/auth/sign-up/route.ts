/**
 * Evolution Combatives - Sign Up API Route
 * Handles admin registration requests
 *
 * @description Secure API endpoint for admin registration with validation
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../src/lib/supabase'

// Request validation schema
const signUpRequestSchema = z.object({
    fullName: z
        .string()
        .min(1, 'Full name is required')
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must not exceed 100 characters'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
})

// Rate limiting storage (in production, use Redis)
const signUpAttempts = new Map<string, { count: number; resetTime: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

/**
 * Rate limiting helper
 */
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const attempts = signUpAttempts.get(identifier)

    // Clean expired entries periodically
    if (Math.random() < 0.1) {
        for (const [key, value] of signUpAttempts.entries()) {
            if (now > value.resetTime) {
                signUpAttempts.delete(key)
            }
        }
    }

    if (!attempts || now > attempts.resetTime) {
        // New window
        const resetTime = now + LOCKOUT_DURATION
        signUpAttempts.set(identifier, { count: 1, resetTime })
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetTime }
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetTime: attempts.resetTime }
    }

    // Increment counter
    attempts.count++
    signUpAttempts.set(identifier, attempts)
    return {
        allowed: true,
        remaining: MAX_ATTEMPTS - attempts.count,
        resetTime: attempts.resetTime
    }
}

/**
 * Clear failed attempts on successful sign up
 */
function clearFailedAttempts(identifier: string) {
    signUpAttempts.delete(identifier)
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
 * POST /api/auth/sign-up
 * Register new admin user
 */
export async function POST(request: NextRequest) {
    try {
        const clientIP = getClientIP(request)
        const rateLimitKey = `signup:${clientIP}`

        // Check rate limiting
        const rateLimit = checkRateLimit(rateLimitKey)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Too many registration attempts',
                    message: 'Please try again later.',
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
        const validatedData = signUpRequestSchema.parse(body)

        // Create Supabase client
        const supabase = await createServerClient()

        // Attempt to create user account
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: validatedData.email,
            password: validatedData.password,
            options: {
                data: {
                    full_name: validatedData.fullName
                },
                emailRedirectTo: `${request.nextUrl.origin}/auth/confirm`
            }
        })

        if (authError) {
            // Log failed attempt for development
            if (process.env.NODE_ENV === 'development') {
                console.error('Sign up auth error:', authError.message)
            }

            return NextResponse.json(
                {
                    success: false,
                    error: 'Registration failed',
                    message: authError.message.includes('already registered')
                        ? 'An account with this email already exists. Please sign in instead.'
                        : authError.message
                },
                {
                    status: 400,
                    headers: {
                        'X-RateLimit-Limit': MAX_ATTEMPTS.toString(),
                        'X-RateLimit-Remaining': (rateLimit.remaining - 1).toString(),
                        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
                    }
                }
            )
        }

        if (!authData.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Registration failed',
                    message: 'Unable to create account. Please try again.'
                },
                { status: 400 }
            )
        }

        // Clear failed attempts on successful sign up
        clearFailedAttempts(rateLimitKey)

        // Return success response
        const response = NextResponse.json({
            success: true,
            message: 'Account created successfully. Please check your email to confirm your account.',
            user: {
                id: authData.user.id,
                email: authData.user.email
            }
        })

        // Set rate limit headers
        response.headers.set('X-RateLimit-Limit', MAX_ATTEMPTS.toString())
        response.headers.set('X-RateLimit-Remaining', MAX_ATTEMPTS.toString())
        response.headers.set('X-RateLimit-Reset', new Date(Date.now() + LOCKOUT_DURATION).toISOString())

        return response

    } catch (error) {
        // Log error for debugging in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Sign up API error:', error)
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
 * GET /api/auth/sign-up
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
