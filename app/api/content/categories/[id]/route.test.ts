import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { GET, PUT, DELETE } from './route'

vi.mock('../../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../../src/services/content', () => ({
  contentQueries: { fetchCategories: vi.fn() },
  contentMutations: {
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}))

import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import { contentQueries, contentMutations } from '../../../../../src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchCategories = vi.mocked(contentQueries.fetchCategories)
const mockUpdateCategory = vi.mocked(contentMutations.updateCategory)
const mockDeleteCategory = vi.mocked(contentMutations.deleteCategory)

const params = { params: Promise.resolve({ id: 'cat-1' }) }

describe('GET /api/content/categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)
    const res = await GET(createNextRequest('/api/content/categories/cat-1'), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when category not found', async () => {
    authSuccess(mockAuth)
    mockFetchCategories.mockResolvedValue([{ id: 'other' }] as never)

    const res = await GET(createNextRequest('/api/content/categories/cat-1'), params)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Category not found')
  })

  it('returns category on success', async () => {
    authSuccess(mockAuth)
    const category = { id: 'cat-1', name: 'Fundamentals' }
    mockFetchCategories.mockResolvedValue([category] as never)

    const res = await GET(createNextRequest('/api/content/categories/cat-1'), params)
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.read')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: category })
  })

  it('returns 500 when fetch throws', async () => {
    authSuccess(mockAuth)
    mockFetchCategories.mockRejectedValue(new Error('db error'))

    const res = await GET(createNextRequest('/api/content/categories/cat-1'), params)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('db error')
  })
})

describe('PUT /api/content/categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 403)
    const res = await PUT(
      createNextRequest('/api/content/categories/cat-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      }),
      params
    )
    expect(res.status).toBe(403)
  })

  it('updates category with provided fields', async () => {
    authSuccess(mockAuth)
    const updated = { id: 'cat-1', name: 'Updated' }
    mockUpdateCategory.mockResolvedValue(updated as never)

    const res = await PUT(
      createNextRequest('/api/content/categories/cat-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated',
          slug: 'updated',
          description: 'desc',
          discipline_id: 'd1',
          color: '#fff',
          icon: 'icon',
          subscription_tier_required: 'tier1',
          sort_order: 2,
          is_active: true,
        }),
      }),
      params
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: updated })
    expect(mockUpdateCategory).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({
        name: 'Updated',
        slug: 'updated',
        subscription_tier_required: 'tier1',
        is_active: true,
      })
    )
  })

  it('returns 500 when update throws', async () => {
    authSuccess(mockAuth)
    mockUpdateCategory.mockRejectedValue(new Error('update failed'))

    const res = await PUT(
      createNextRequest('/api/content/categories/cat-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'x' }),
      }),
      params
    )
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/content/categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)
    const res = await DELETE(
      createNextRequest('/api/content/categories/cat-1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(401)
  })

  it('deletes category', async () => {
    authSuccess(mockAuth)
    mockDeleteCategory.mockResolvedValue(undefined as never)

    const res = await DELETE(
      createNextRequest('/api/content/categories/cat-1', { method: 'DELETE' }),
      params
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, message: 'Category deleted successfully' })
    expect(mockDeleteCategory).toHaveBeenCalledWith('cat-1')
  })

  it('returns 500 when delete throws', async () => {
    authSuccess(mockAuth)
    mockDeleteCategory.mockRejectedValue(new Error('has videos'))

    const res = await DELETE(
      createNextRequest('/api/content/categories/cat-1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('has videos')
  })
})
