import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export interface MobileAuthContext {
    user: User
    supabase: SupabaseClient
}

export type MobileAuthResult =
    | { data: MobileAuthContext }
    | { error: NextResponse }

const jsonError = (status: number, error: string) =>
    NextResponse.json({ success: false, error }, { status })

/**
 * Authenticate a mobile API request with a Supabase access token.
 *
 * Mobile routes deliberately use bearer authentication instead of cookies and
 * CSRF tokens. The returned client carries the caller's JWT so every database
 * lookup remains subject to that user's RLS policies.
 */
export async function authenticateMobileBearer(
    request: NextRequest
): Promise<MobileAuthResult> {
    const authorization = request.headers.get('authorization')
    const match = authorization?.match(/^Bearer ([^\s]+)$/)

    if (!match) {
        return {
            error: jsonError(401, 'Bearer token required for mobile API'),
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            error: jsonError(500, 'Authentication service is not configured'),
        }
    }

    try {
        const token = match[1]
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        })

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token)

        if (error || !user) {
            return {
                error: jsonError(401, 'Invalid authentication token'),
            }
        }

        return { data: { user, supabase } }
    } catch {
        return {
            error: jsonError(500, 'Authentication failed'),
        }
    }
}
