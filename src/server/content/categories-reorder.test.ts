import { describe, it, expect, vi, beforeEach } from 'vitest'
import { json as jsonResponse } from '@/src/lib/http'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess } from '@/test/helpers/auth'
import { POST as POSTHandler } from './categories-reorder'
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('@/src/services/content', () => ({
  contentMutations: { reorderContent: vi.fn() },
}))

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { contentMutations } from '@/src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockReorder = vi.mocked(contentMutations.reorderContent)

describe('POST /api/content/categories/reorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires auth', async () => {
    mockAuth.mockResolvedValue({
      error: jsonResponse({ success: false, error: 'Authentication required' }, { status: 401 }),
    })
    const res = await POST(
      createNextRequest('/api/content/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ reorderData: [] }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 when reorderData is not an array', async () => {
    authSuccess(mockAuth)
    const res = await POST(
      createNextRequest('/api/content/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ reorderData: 'bad' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('reorderData must be an array')
  })

  it('returns 400 when item missing id or sort_order', async () => {
    authSuccess(mockAuth)
    const res = await POST(
      createNextRequest('/api/content/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ reorderData: [{ id: 'c1' }] }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('Each item must have id and sort_order')
  })

  it('reorders categories successfully', async () => {
    authSuccess(mockAuth)
    mockReorder.mockResolvedValue()

    const reorderData = [
      { id: 'c1', sort_order: 1 },
      { id: 'c2', sort_order: 2 },
    ]
    const res = await POST(
      createNextRequest('/api/content/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ reorderData }),
      })
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, message: 'Categories reordered successfully' })
    expect(mockReorder).toHaveBeenCalledWith('categories', reorderData)
  })

  it('returns 500 when reorder throws', async () => {
    authSuccess(mockAuth)
    mockReorder.mockRejectedValue(new Error('reorder failed'))

    const res = await POST(
      createNextRequest('/api/content/categories/reorder', {
        method: 'POST',
        body: JSON.stringify({ reorderData: [{ id: 'c1', sort_order: 1 }] }),
      })
    )
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('reorder failed')
  })
})
