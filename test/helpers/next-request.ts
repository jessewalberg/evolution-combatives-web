/**
 * Request fixture builders for handler tests. Historically these produced
 * NextRequest instances; the TanStack Start handlers take plain Web
 * Requests, so these now build standard Request objects. The names are
 * kept to avoid churn across the ported test suites.
 */

export function createNextRequest(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string | null
    cookies?: Record<string, string>
  }
): Request {
  const headers = new Headers(init?.headers)
  if (init?.cookies) {
    const cookieHeader = Object.entries(init.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    headers.set('cookie', cookieHeader)
  }

  return new Request(new URL(url, 'http://localhost:3000'), {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ?? undefined,
  })
}

export function createAuthenticatedRequest(
  url: string,
  user: { userId: string; role: string; email: string },
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string | null
    cookies?: Record<string, string>
  }
): Request {
  return createNextRequest(url, {
    ...init,
    headers: {
      ...init?.headers,
      'X-User-ID': user.userId,
      'X-User-Role': user.role,
      'X-User-Email': user.email,
    },
  })
}
