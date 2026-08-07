import { NextRequest } from 'next/server'

export function createNextRequest(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string | null
    cookies?: Record<string, string>
  }
): NextRequest {
  const headers = new Headers(init?.headers)
  if (init?.cookies) {
    const cookieHeader = Object.entries(init.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    headers.set('cookie', cookieHeader)
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
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
): NextRequest {
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
