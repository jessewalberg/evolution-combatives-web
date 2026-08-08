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
