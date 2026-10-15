/**
 * Evolution Combatives - Login API Route
 * Handles admin authentication requests
 *
 * @description Secure API endpoint for admin login with validation
 * @author Evolution Combatives
 */

import { z } from 'zod'
import { createServerClient } from '@/src/lib/supabase'
import { json } from '@/src/lib/http'

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

/**
 * POST /api/auth/login
 * Authenticate admin user
 */
export async function POST({ request }: { request: Request }) {
    try {
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

            return json(
                {
                    success: false,
                    error: 'Authentication failed',
                    message: authError?.message.includes('Invalid')
                        ? 'Invalid email or password. Please check your credentials and try again.'
                        : authError?.message.includes('Email not confirmed')
                            ? 'Please check your email and click the confirmation link before signing in.'
                            : 'Authentication failed. Please try again.'
                },
                { status: 401 }
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

            return json(
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

            return json(
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

        // Return success response
        return json({
            success: true,
            message: 'Login successful',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: profile.admin_role,
                name: profile.full_name
            }
        })

    } catch (error) {
        // Log error for debugging in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Login API error:', error)
        }

        if (error instanceof z.ZodError) {
            return json(
                {
                    success: false,
                    error: 'Validation error',
                    message: 'Invalid request data',
                    details: error.issues
                },
                { status: 400 }
            )
        }

        return json(
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
    return json(
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
    return json(
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
    return json(
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
    return json(
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
