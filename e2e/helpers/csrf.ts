import type { APIRequestContext, Page } from '@playwright/test'

const CSRF_HEADER = 'X-CSRF-Token'

/**
 * Obtain a CSRF token the same way the app does (GET /api/csrf-token) and
 * return headers suitable for mutating /api/* requests.
 */
export async function fetchCsrfHeaders(
  request: APIRequestContext
): Promise<Record<string, string>> {
  const response = await request.get('/api/csrf-token')
  if (!response.ok()) {
    throw new Error(`Failed to fetch CSRF token: ${response.status()}`)
  }

  const body = (await response.json()) as { success: boolean; csrfToken?: string }
  if (!body.success || !body.csrfToken) {
    throw new Error('CSRF token response missing csrfToken')
  }

  return {
    [CSRF_HEADER]: body.csrfToken,
    'Content-Type': 'application/json',
  }
}

/**
 * Browser-context CSRF fetch (uses page cookies so __Host-/csrf-token cookie is set).
 */
export async function fetchCsrfHeadersFromPage(
  page: Page
): Promise<Record<string, string>> {
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/csrf-token')
    if (!res.ok) {
      throw new Error(`CSRF fetch failed: ${res.status}`)
    }
    const data = (await res.json()) as { success: boolean; csrfToken?: string }
    if (!data.success || !data.csrfToken) {
      throw new Error('CSRF token missing in response')
    }
    return data.csrfToken
  })

  return {
    [CSRF_HEADER]: result,
    'Content-Type': 'application/json',
  }
}

export { CSRF_HEADER }
