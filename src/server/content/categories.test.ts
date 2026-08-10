import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { GET, POST as POSTHandler } from './categories'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('@/src/services/content', () => ({
  contentQueries: { fetchCategories: vi.fn() },
  contentMutations: { createCategory: vi.fn() },
}))

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { contentQueries, contentMutations } from '@/src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchCategories = vi.mocked(contentQueries.fetchCategories)
const mockCreateCategory = vi.mocked(contentMutations.createCategory)

describe('GET /api/content/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when auth fails', async () => {
    authFail(mockAuth, 401)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockFetchCategories).not.toHaveBeenCalled()
  })

  it('returns categories on success', async () => {
    authSuccess(mockAuth)
    const categories = [{ id: 'c1', name: 'Fundamentals' }]
    mockFetchCategories.mockResolvedValue(categories as never)

    const res = await GET()
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.read')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: categories })
    expect(mockFetchCategories).toHaveBeenCalledWith(undefined, true)
  })

  it('returns 500 when fetch throws', async () => {
    authSuccess(mockAuth)
    mockFetchCategories.mockRejectedValue(new Error('db down'))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('db down')
  })
})

describe('POST /api/content/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when auth fails', async () => {
    authFail(mockAuth, 403)
    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', slug: 'x', discipline_id: 'd1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    authSuccess(mockAuth)
    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cat', slug: 'cat' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('discipline_id')
  })

  it('returns 400 when name is missing', async () => {
    authSuccess(mockAuth)
    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({ slug: 'cat', discipline_id: 'd1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('name')
  })

  it('returns 400 when slug is missing', async () => {
    authSuccess(mockAuth)
    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cat', discipline_id: 'd1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('slug')
  })

  it('creates category on success', async () => {
    authSuccess(mockAuth)
    const created = { id: 'c1', name: 'Cat', slug: 'cat', discipline_id: 'd1' }
    mockCreateCategory.mockResolvedValue(created as never)

    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cat',
        slug: 'cat',
        discipline_id: 'd1',
        description: 'desc',
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(201)
    expect(body).toEqual({ success: true, data: created })
    expect(mockCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cat',
        slug: 'cat',
        discipline_id: 'd1',
        description: 'desc',
        color: '#6B7280',
        subscription_tier_required: 'none',
        is_active: true,
      })
    )
  })

  it('respects custom optional fields and is_active false', async () => {
    authSuccess(mockAuth)
    mockCreateCategory.mockResolvedValue({ id: 'c2' } as never)

    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cat',
        slug: 'cat',
        discipline_id: 'd1',
        color: '#FF0000',
        icon: 'shield',
        subscription_tier_required: 'tier2',
        sort_order: 5,
        is_active: false,
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(mockCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        color: '#FF0000',
        icon: 'shield',
        subscription_tier_required: 'tier2',
        sort_order: 5,
        is_active: false,
        description: null,
      })
    )
  })

  it('returns 500 when create throws', async () => {
    authSuccess(mockAuth)
    mockCreateCategory.mockRejectedValue(new Error('create failed'))

    const req = createNextRequest('/api/content/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cat', slug: 'cat', discipline_id: 'd1' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('create failed')
  })
})
