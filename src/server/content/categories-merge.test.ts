import { describe, it, expect, vi, beforeEach } from 'vitest'
import { json as jsonResponse } from '@/src/lib/http'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess } from '@/test/helpers/auth'
import { POST as POSTHandler } from './categories-merge'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('@/src/services/content', () => ({
  contentMutations: { mergeCategories: vi.fn() },
}))

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { contentMutations } from '@/src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockMerge = vi.mocked(contentMutations.mergeCategories)

describe('POST /api/content/categories/merge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires auth', async () => {
    mockAuth.mockResolvedValue({
      error: jsonResponse({ success: false, error: 'Authentication required' }, { status: 401 }),
    })
    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1', sourceIds: ['s1'] }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when targetId or sourceIds missing', async () => {
    authSuccess(mockAuth)
    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('targetId and sourceIds are required')
  })

  it('returns 400 when sourceIds is empty', async () => {
    authSuccess(mockAuth)
    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1', sourceIds: [] }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('At least one source category is required')
  })

  it('returns 400 when target is in source list', async () => {
    authSuccess(mockAuth)
    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1', sourceIds: ['t1', 's2'] }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('Target category cannot be in source list')
  })

  it('merges categories successfully', async () => {
    authSuccess(mockAuth)
    mockMerge.mockResolvedValue()

    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1', sourceIds: ['s1', 's2'] }),
      })
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, message: 'Categories merged successfully' })
    expect(mockMerge).toHaveBeenCalledWith('t1', ['s1', 's2'])
  })

  it('returns 500 when merge throws', async () => {
    authSuccess(mockAuth)
    mockMerge.mockRejectedValue(new Error('merge failed'))

    const res = await POST(
      createNextRequest('/api/content/categories/merge', {
        method: 'POST',
        body: JSON.stringify({ targetId: 't1', sourceIds: ['s1'] }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('merge failed')
  })
})
