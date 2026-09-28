import { createServerClient } from './supabase'
import { json } from './http'

export interface AuthenticatedUser {
    userId: string
    email: string
}

/**
 * Require a Supabase session from auth cookies. Used for CSRF issuance and
 * checkout — never trust caller-supplied user ids or emails.
 */
export async function requireAuthenticatedSession(): Promise<
    AuthenticatedUser | { error: Response }
> {
    try {
        const supabase = await createServerClient()
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user?.email) {
            return {
                error: json({ success: false, error: 'Authentication required' }, { status: 401 }),
            }
        }

        return {
            userId: user.id,
            email: user.email.toLowerCase().trim(),
        }
    } catch {
        return {
            error: json({ success: false, error: 'Authentication failed' }, { status: 500 }),
        }
    }
}
