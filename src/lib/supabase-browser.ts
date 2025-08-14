/**
 * Evolution Combatives - Browser-only Supabase Client
 * Safe for use in client components
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '../lib/shared/types/database'

// Browser client for client components
export const createBrowserClient = () =>
    createClientComponentClient<Database>()

// Default browser client instance
export const supabase = createBrowserClient()

// Export for compatibility
export { createClientComponentClient }

// NOTE: Admin client removed from browser file for security
// Use createAdminClient from '../lib/supabase' in server-side code only