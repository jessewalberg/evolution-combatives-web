/**
 * Bearer-token authentication for the mobile API endpoints. Mobile requests
 * carry a Supabase JWT and are exempt from CSRF (no cookie auth involved).
 * Shared by /api/mobile/* server routes.
 */

import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './supabase'
import { json } from './http'

export async function validateMobileAppAuth(request: Request, label = 'Mobile API') {
    try {
        const authHeader = request.headers.get('Authorization')
        const mobileClient = request.headers.get('X-Mobile-Client')
        const userAgent = request.headers.get('User-Agent')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                error: json(
                    { success: false, error: 'Bearer token required for mobile API' },
                    { status: 401 }
                )
            }
        }

        // Verify this is actually a mobile client request
        if (!mobileClient || !userAgent?.includes('EvolutionCombatives-Mobile')) {
            console.warn(`🚨 [${label}] Non-mobile client accessing mobile endpoint:`, {
                mobileClient,
                userAgent
            })
            // Allow it but log the warning
        }

        const token = authHeader.replace('Bearer ', '')

        // Create Supabase client with the provided JWT token
        const { url, anonKey } = getSupabaseConfig()
        const supabase = createClient(url, anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        })

        // Verify the user with the token
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            console.error(`❌ [${label}] User validation failed:`, userError)
            return {
                error: json(
                    { success: false, error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }
        }

        return { user, supabase }
    } catch (error) {
        console.error(`[${label}] Auth validation error:`, error)
        return {
            error: json(
                { success: false, error: 'Authentication failed' },
                { status: 500 }
            )
        }
    }
}
