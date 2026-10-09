import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for fixture teardown when no app API exists
 * (e.g. auth users, subscriptions, Q&A rows). Prefer app admin APIs when available.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E fixture cleanup'
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
