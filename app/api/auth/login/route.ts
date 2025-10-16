/**
 * Evolution Combatives - Login API Route
 * Handles admin authentication requests
 * 
 * @description Secure API endpoint for admin login with rate limiting and validation
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../src/lib/supabase'

// Request validation schema
const loginRequestSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
    rememberMe: z.boolean().optional().default(false)
})

// Rate limiting storage (in production, use Redis)
const loginAttempts = new Map<string, { count: number; resetTime: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

/**
 * Rate limiting helper
 */
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const attempts = loginAttempts.get(identifier)

    // Clean expired entries periodically
    if (Math.random() < 0.1) {
        for (const [key, value] of loginAttempts.entries()) {
            if (now > value.resetTime) {
                loginAttempts.delete(key)
            }
        }
    }

    if (!attempts || now > attempts.resetTime) {
        // New window
        const resetTime = now + LOCKOUT_DURATION
        loginAttempts.set(identifier, { count: 1, resetTime })
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetTime }
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        // Rate limit exceeded
        return { allowed: false, remaining: 0, resetTime: attempts.resetTime }
    }

    // Increment counter
    attempts.count++
    loginAttempts.set(identifier, attempts)
    return {
        allowed: true,
        remaining: MAX_ATTEMPTS - attempts.count,
        resetTime: attempts.resetTime
    }
}

/**
 * Clear failed attempts on successful login
 */
function clearFailedAttempts(identifier: string) {
    loginAttempts.delete(identifier)
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
 * POST /api/auth/login
 * Authenticate admin user
 */
export async function POST(request: NextRequest) {
    try {
        const clientIP = getClientIP(request)
        const rateLimitKey = `login:${clientIP}`

        // Check rate limiting
        const rateLimit = checkRateLimit(rateLimitKey)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Too many failed attempts',
                    message: 'Account temporarily locked. Please try again later.',
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
        const validatedData = loginRequestSchema.parse(body)

        // Create Supabase client
        const supabase = await createServerClient()

        // Attempt authentication
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: validatedData.email,
            password: validatedData.password
        })

        if (authError || !authData.user) {
            // Log failed attempt for development
            if (process.env.NODE_ENV === 'development') {
                console.error('Login auth error:', authError?.message)
            }

            return NextResponse.json(
                {
                    success: false,
                    error: 'Authentication failed',
                    message: authError?.message.includes('Invalid')
                        ? 'Invalid email or password. Please check your credentials and try again.'
                        : authError?.message.includes('Email not confirmed')
                            ? 'Please check your email and click the confirmation link before signing in.'
                            : 'Authentication failed. Please try again.'
                },
                {
                    status: 401,
                    headers: {
                        'X-RateLimit-Limit': MAX_ATTEMPTS.toString(),
                        'X-RateLimit-Remaining': (rateLimit.remaining - 1).toString(),
                        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
                    }
                }
            )
        }

        // Verify admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('admin_role, full_name, last_login_at')
            .eq('id', authData.user.id)
            .single()

        if (profileError || !profile) {
            // Sign out the user since profile fetch failed
            await supabase.auth.signOut()

            return NextResponse.json(
                {
                    success: false,
                    error: 'Profile verification failed',
                    message: 'Unable to verify admin access. Please contact support.'
                },
                { status: 403 }
            )
        }

        if (!profile.admin_role) {
            // Sign out the user since they're not an admin
            await supabase.auth.signOut()

            return NextResponse.json(
                {
                    success: false,
                    error: 'Access denied',
                    message: 'This account does not have admin privileges.'
                },
                { status: 403 }
            )
        }

        // Update last login timestamp
        await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', authData.user.id)

        // Clear failed attempts on successful login
        clearFailedAttempts(rateLimitKey)

        // Return success response
        const response = NextResponse.json({
            success: true,
            message: 'Login successful',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: profile.admin_role,
                name: profile.full_name
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
            console.error('Login API error:', error)
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
 * GET /api/auth/login
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
