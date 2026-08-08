import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { GET } from './route'

vi.mock('../../../src/lib/csrf-protection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/csrf-protection')>()
  return {
    ...actual,
    generateCSRFToken: vi.fn(),
  }
})

import { generateCSRFToken } from '../../../src/lib/csrf-protection'

const mockGenerate = vi.mocked(generateCSRFToken)

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
    expect(res.cookies.get('csrf-token')?.value).toBe('csrf-test-token')
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
    expect(res.cookies.get('__Host-csrf-token')?.value).toBe('csrf-secure-token')
    expect(res.cookies.get('csrf-token')).toBeUndefined()

    // Next.js serializes cookie options into Set-Cookie; Secure must be present
    // on the HTTPS / __Host- path (attribute casing may vary by runtime).
    const setCookie = res.headers.getSetCookie?.() ?? []
    const hostCookie = setCookie.find((c) => c.startsWith('__Host-csrf-token='))
    expect(hostCookie).toBeDefined()
    expect(hostCookie!.toLowerCase()).toContain('secure')
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
