import { createServerClient } from '@supabase/ssr'
import type { BrowserContext } from '@playwright/test'

/**
 * Sign in a Supabase user and persist SSR auth cookies on the Playwright context.
 */
export async function signInUserSession(
  context: BrowserContext,
  baseURL: string,
  email: string,
  password: string
): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for user session sign-in')
  }

  const pending: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          pending.push({
            name: cookie.name,
            value: cookie.value,
            options: (cookie.options ?? {}) as Record<string, unknown>,
          })
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw error
  }

  const host = new URL(baseURL).hostname
  await context.addCookies(
    pending.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: host,
      path: typeof cookie.options.path === 'string' ? cookie.options.path : '/',
      httpOnly: Boolean(cookie.options.httpOnly),
      secure: baseURL.startsWith('https'),
      sameSite:
        cookie.options.sameSite === 'strict'
          ? 'Strict'
          : cookie.options.sameSite === 'none'
            ? 'None'
            : 'Lax',
    }))
  )
}
