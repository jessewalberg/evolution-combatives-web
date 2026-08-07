import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createNextRequest } from '@/test/helpers/next-request'
import { GET, POST } from './route'

vi.mock('../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../src/services/content', () => ({
  contentQueries: { fetchDisciplines: vi.fn() },
  contentMutations: { createDiscipline: vi.fn() },
}))

import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { contentQueries, contentMutations } from '../../../../src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchDisciplines = vi.mocked(contentQueries.fetchDisciplines)
const mockCreateDiscipline = vi.mocked(contentMutations.createDiscipline)

function authSuccess() {
  mockAuth.mockResolvedValue({
    user: { userId: 'u1', role: 'content_admin', email: 'admin@test.com' },
  })
}

describe('GET /api/content/disciplines', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when auth fails', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns disciplines on success', async () => {
    authSuccess()
    const disciplines = [{ id: 'd1', name: 'Jiu Jitsu' }]
    mockFetchDisciplines.mockResolvedValue(disciplines as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: disciplines })
    expect(mockFetchDisciplines).toHaveBeenCalledWith(true)
  })

  it('returns 500 when fetch throws', async () => {
    authSuccess()
    mockFetchDisciplines.mockRejectedValue(new Error('fetch fail'))

    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('fetch fail')
  })
})

describe('POST /api/content/disciplines', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when auth fails', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'denied' }, { status: 401 }),
    })
    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wrestling', slug: 'wrestling' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields missing', async () => {
    authSuccess()
    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wrestling' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('slug')
  })

  it('returns 400 when name is missing', async () => {
    authSuccess()
    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({ slug: 'wrestling' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('name')
  })

  it('creates discipline on success', async () => {
    authSuccess()
    const created = { id: 'd1', name: 'Wrestling', slug: 'wrestling' }
    mockCreateDiscipline.mockResolvedValue(created as never)

    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wrestling', slug: 'wrestling' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ success: true, data: created })
    expect(mockCreateDiscipline).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Wrestling',
        slug: 'wrestling',
        color: '#3B82F6',
        subscription_tier_required: 'none',
        is_active: true,
      })
    )
  })

  it('respects custom optional fields', async () => {
    authSuccess()
    mockCreateDiscipline.mockResolvedValue({ id: 'd2' } as never)

    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Striking',
        slug: 'striking',
        description: 'desc',
        color: '#111111',
        icon: 'fist',
        subscription_tier_required: 'tier3',
        sort_order: 9,
        is_active: false,
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(mockCreateDiscipline).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'desc',
        color: '#111111',
        icon: 'fist',
        subscription_tier_required: 'tier3',
        sort_order: 9,
        is_active: false,
      })
    )
  })

  it('returns 500 when create throws', async () => {
    authSuccess()
    mockCreateDiscipline.mockRejectedValue(new Error('create fail'))

    const req = createNextRequest('/api/content/disciplines', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wrestling', slug: 'wrestling' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('create fail')
  })
})
