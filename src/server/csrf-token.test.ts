import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { GET as GETHandler } from './csrf-token'
const GET = (request?: Request) => GETHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/csrf-protection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/csrf-protection')>()
  return {
    ...actual,
    generateCSRFToken: vi.fn(),
  }
})

import { generateCSRFToken } from '@/src/lib/csrf-protection'

const mockGenerate = vi.mocked(generateCSRFToken)

const setCookie = vi.fn()
vi.mock('@tanstack/react-start/server', () => ({
  setCookie: (...args: unknown[]) => (setCookie as (...a: unknown[]) => unknown)(...args),
}))

describe('GET /api/csrf-token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns token and sets cookie', async () => {
    mockGenerate.mockReturnValue('csrf-test-token')

    const res = await GET(createNextRequest('/api/csrf-token'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.csrfToken).toBe('csrf-test-token')
    expect(body.expiresAt).toBeDefined()
    expect(setCookie).toHaveBeenCalledWith(
      'csrf-token',
      'csrf-test-token',
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'strict', path: '/' })
    )
  })

  it('sets __Host-csrf-token with Secure when x-forwarded-proto is https', async () => {
    mockGenerate.mockReturnValue('csrf-secure-token')

    const res = await GET(
      createNextRequest('/api/csrf-token', {
        headers: { 'x-forwarded-proto': 'https' },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.csrfToken).toBe('csrf-secure-token')
    // Secure host-only cookie on the HTTPS path
    expect(setCookie).toHaveBeenCalledWith(
      '__Host-csrf-token',
      'csrf-secure-token',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' })
    )
  })

  it('returns 500 when token generation fails', async () => {
    mockGenerate.mockImplementation(() => {
      throw new Error('rng fail')
    })

    const res = await GET(createNextRequest('/api/csrf-token'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({
      success: false,
      error: 'Failed to generate CSRF token',
    })
  })
})
