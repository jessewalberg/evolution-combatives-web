import { createServerClient } from './supabase'
import { json } from './http'

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000

export interface ApiUser {
    userId: string
    role: string
    email: string
}

export const ROLE_PERMISSIONS: Record<string, Set<string>> = {
    super_admin: new Set([
        'admin.all',
        'content.read', 'content.write', 'content.delete',
        'users.read', 'users.write', 'users.delete',
        'analytics.read', 'analytics.write',
        'support.read', 'support.write'
    ]),
    content_admin: new Set(['content.read', 'content.write', 'content.delete', 'users.read']),
    support_admin: new Set(['users.read', 'support.read', 'support.write'])
}

export function hasPermission(userRole: string, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] || new Set<string>()
    return permissions.has('admin.all') || permissions.has(permission)
}

export async function validateApiAuthWithSession(requiredPermission: string): Promise<{ user: ApiUser } | { error: Response }> {
    try {
        const supabase = await createServerClient()

        // Get user (more secure than getSession)
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return {
                error: json({ success: false, error: 'Authentication required' }, { status: 401 })
            }
        }

        // Get user profile with admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('admin_role, last_login_at')
            .eq('id', user.id)
            .single()

        if (profileError || !profile?.admin_role) {
            return {
                error: json({ success: false, error: 'Admin role required' }, { status: 403 })
            }
        }

        // Session timeout based on last login (parity with authGuardMiddleware)
        if (profile.last_login_at) {
            const lastLoginTime = new Date(profile.last_login_at).getTime()
            if (Date.now() - lastLoginTime > SESSION_TIMEOUT_MS) {
                return {
                    error: json({ success: false, error: 'Session expired' }, { status: 401 })
                }
            }
        }

        // Check permissions
        if (!hasPermission(profile.admin_role, requiredPermission)) {
            return {
                error: json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
            }
        }

        return {
            user: {
                userId: user.id,
                role: profile.admin_role,
                email: user.email || ''
            }
        }
    } catch {
        return {
            error: json({ success: false, error: 'Authentication failed' }, { status: 500 })
        }
    }
}

/**
 * Legacy signature kept for ported call sites. The old implementation read
 * X-User-* headers injected by Next middleware; sessions are now validated
 * directly from auth cookies.
 */
export async function validateApiAuth(_request: Request, requiredPermission: string): Promise<{ user: ApiUser } | { error: Response }> {
    return validateApiAuthWithSession(requiredPermission)
}
