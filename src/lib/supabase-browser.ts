/**
 * Evolution Combatives - Browser-only Supabase Client
 * Safe for use in client components
 */

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'
import type { Database } from './shared/types/database'

// Compatibility name retained for existing client-component callers.
export const createClientComponentClient = () =>
    createSupabaseBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

// Browser client for client components
export const createBrowserClient = createClientComponentClient

// Default browser client instance
export const supabase = createBrowserClient()

// NOTE: Admin client removed from browser file for security
// Use createAdminClient from './supabase' in server-side code only
