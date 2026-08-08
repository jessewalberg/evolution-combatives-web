import type { Page } from '@playwright/test'
import { installDeterminism, installVisualMocks, type InstallVisualMocksOptions } from './mock-api'

/**
 * Read the authenticated user id from Playwright storageState cookies when
 * available so profile mocks can align with the real session.
 */
export async function resolveSessionUserId(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies()
  const authCookie = cookies.find((c) => c.name.includes('auth-token'))
  if (!authCookie?.value) return undefined

  try {
    const decoded = decodeURIComponent(authCookie.value)
    // Cookie may be base64-encoded JSON array/object from @supabase/ssr.
    const jsonStart = decoded.indexOf('{')
    const jsonArrayStart = decoded.indexOf('[')
    const start =
      jsonStart === -1
        ? jsonArrayStart
        : jsonArrayStart === -1
          ? jsonStart
          : Math.min(jsonStart, jsonArrayStart)
    if (start === -1) return undefined
    const parsed = JSON.parse(decoded.slice(start)) as
      | { user?: { id?: string }; currentSession?: { user?: { id?: string } } }
      | Array<{ user?: { id?: string } }>
    if (Array.isArray(parsed)) {
      return parsed[0]?.user?.id
    }
    return parsed.user?.id || parsed.currentSession?.user?.id
  } catch {
    return undefined
  }
}

export async function prepareVisualPage(
  page: Page,
  options: InstallVisualMocksOptions = {}
): Promise<void> {
  await installDeterminism(page)
  const sessionUserId = options.sessionUserId ?? (await resolveSessionUserId(page))
  await installVisualMocks(page, { ...options, sessionUserId })
}
