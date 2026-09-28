/**
 * Evolution Combatives - Logout API Route
 * Handles admin logout requests
 *
 * @description Secure API endpoint for admin logout with audit logging
 * @author Evolution Combatives
 */

import { createServerClient } from '@/src/lib/supabase'
import { json } from '@/src/lib/http'

/**
 * POST /api/auth/logout
 * Sign out admin user
 */
export async function POST() {
    try {
        // Create Supabase client

        const supabase = await createServerClient()

        // Get current session for audit logging
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            // Log logout activity (optional - uncomment if you want audit logging)
            /*
            try {
                await supabase
                    .from('admin_activity')
                    .insert({
                        admin_id: session.user.id,
                        action: 'logout',
                        details: {
                            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
                            user_agent: request.headers.get('user-agent') || 'unknown'
                        },
                        created_at: new Date().toISOString()
                    })
            } catch (logError) {
                // Don't fail logout if audit logging fails
                if (process.env.NODE_ENV === 'development') {
                    console.warn('Failed to log logout activity:', logError)
                }
            }
            */
        }

        // Sign out user
        const { error } = await supabase.auth.signOut()

        if (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Logout error:', error)
            }

            return json(
                {
                    success: false,
                    error: 'Logout failed',
                    message: error.message
                },
                { status: 500 }
            )
        }

        // Clear any server-side session data
        const response = json({
            success: true,
            message: 'Logged out successfully'
        })

        // Clear auth-related cookies
        const { deleteCookie } = await import('@tanstack/react-start/server')
        deleteCookie('sb-access-token')
        deleteCookie('sb-refresh-token')

        return response

    } catch (error) {
        // Log error for debugging in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Logout API error:', error)
        }

        return json(
            {
                success: false,
                error: 'Internal server error',
                message: 'An unexpected error occurred during logout.'
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/auth/logout
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
