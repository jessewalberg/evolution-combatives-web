/**
 * Evolution Combatives - Browser-only Supabase Client
 * Safe for use in client components
 */

import { createBrowserClient, createClientComponentClient } from './supabase'

export { createBrowserClient, createClientComponentClient }

// Default browser client instance (lazy singleton lives in ./supabase)
export const supabase = createBrowserClient()

// NOTE: Admin client removed from browser file for security
// Use createAdminClient from '../lib/supabase' in server-side code only
