import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST, GET, PUT, DELETE, PATCH } from './route'

vi.mock('../../../../src/lib/supabase', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '../../../../src/lib/supabase'

const mockCreateServerClient = vi.mocked(createServerClient)

const validBody = {
  fullName: 'Jane Admin',
  email: 'Jane@test.com',
  password: 'Password1',
}

describe('POST /api/auth/sign-up', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for validation errors', async () => {
    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify({ fullName: 'A', email: 'bad', password: 'weak' }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Validation error')
  })

  it('returns 400 when email already registered', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'User already registered' },
        }),
      },
    } as never)

    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.5' },
        body: JSON.stringify(validBody),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Registration failed')
    expect(body.message).toContain('already exists')
  })

  it('returns 400 when auth succeeds but user is missing', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never)

    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.6' },
        body: JSON.stringify(validBody),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.message).toContain('Unable to create account')
  })

  it('creates account successfully', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: 'u-new', email: 'jane@test.com' } },
      error: null,
    })
    mockCreateServerClient.mockResolvedValue({ auth: { signUp } } as never)

    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      user: { id: 'u-new', email: 'jane@test.com' },
    })
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@test.com',
        password: 'Password1',
        options: expect.objectContaining({
          data: { full_name: 'Jane Admin' },
        }),
      })
    )
  })

  it('returns generic auth error message when not already-registered', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Signup disabled' },
        }),
      },
    } as never)

    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.message).toBe('Signup disabled')
  })

  it('returns 500 on unexpected errors', async () => {
    mockCreateServerClient.mockRejectedValue(new Error('db down'))

    const res = await POST(
      createNextRequest('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Internal server error')
  })
})

describe('method guards /api/auth/sign-up', () => {
  it('returns 405 for non-POST methods', async () => {
    expect((await GET()).status).toBe(405)
    expect((await PUT()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
    expect((await PATCH()).status).toBe(405)
  })
})
