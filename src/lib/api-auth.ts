import { NextRequest } from 'next/server'
import { createServerComponentClient } from './supabase'

export interface ApiUser {
    userId: string
    role: string
    email: string
}

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
    super_admin: new Set([
        'admin.all',
        'content.read', 'content.write', 'content.delete',
        'users.read', 'users.write', 'users.delete',
        'analytics.read', 'analytics.write',
        'support.read', 'support.write'
    ]),
    content_admin: new Set(['content.read', 'content.write', 'content.delete']),
    support_admin: new Set(['users.read', 'support.read', 'support.write'])
}

export function extractUserFromRequest(request: NextRequest): ApiUser | null {
    const userId = request.headers.get('X-User-ID')
    const role = request.headers.get('X-User-Role')
    const email = request.headers.get('X-User-Email')

    if (!userId || !role || !email) {
        return null
    }

    return { userId, role, email }
}

export function hasPermission(userRole: string, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] || new Set<string>()
    return permissions.has('admin.all') || permissions.has(permission)
}

export async function validateApiAuthWithSession(requiredPermission: string): Promise<{ user: ApiUser } | { error: Response }> {
    try {
        const supabase = await createServerComponentClient()
        
        // Get user (more secure than getSession)
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
            return { 
                error: new Response(
                    JSON.stringify({ success: false, error: 'Authentication required' }), 
                    { status: 401, headers: { 'Content-Type': 'application/json' } }
                )
            }
        }

        // Get user profile with admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('admin_role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile?.admin_role) {
            return { 
                error: new Response(
                    JSON.stringify({ success: false, error: 'Admin role required' }), 
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                )
            }
        }

        // Check permissions
        if (!hasPermission(profile.admin_role, requiredPermission)) {
            return { 
                error: new Response(
                    JSON.stringify({ success: false, error: 'Insufficient permissions' }), 
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                )
            }
        }

        return { 
            user: {
                userId: user.id,
                role: profile.admin_role,
                email: user.email || ''
            }
        }
    } catch (error) {
        return { 
            error: new Response(
                JSON.stringify({ success: false, error: 'Authentication failed' }), 
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }
}

export function validateApiAuth(request: NextRequest, requiredPermission: string): { user: ApiUser } | { error: Response } {
    const user = extractUserFromRequest(request)
    
    if (!user) {
        return { 
            error: new Response(
                JSON.stringify({ success: false, error: 'Authentication required' }), 
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    if (!hasPermission(user.role, requiredPermission)) {
        return { 
            error: new Response(
                JSON.stringify({ success: false, error: 'Insufficient permissions' }), 
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    return { user }
}