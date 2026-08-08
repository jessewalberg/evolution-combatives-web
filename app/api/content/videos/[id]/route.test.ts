import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { GET } from './route'

vi.mock('../../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../../src/services/content', () => ({
  contentQueries: { fetchVideoById: vi.fn() },
}))

import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import { contentQueries } from '../../../../../src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchVideoById = vi.mocked(contentQueries.fetchVideoById)

describe('GET /api/content/videos/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)

    const res = await GET(createNextRequest('/api/content/videos/v1'), {
      params: Promise.resolve({ id: 'v1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when video id is empty', async () => {
    authSuccess(mockAuth)

    const res = await GET(createNextRequest('/api/content/videos/'), {
      params: Promise.resolve({ id: '' }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Video ID is required')
  })

  it('returns 404 when video not found', async () => {
    authSuccess(mockAuth)
    mockFetchVideoById.mockResolvedValue(null as never)

    const res = await GET(createNextRequest('/api/content/videos/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Video not found')
  })

  it('returns video on success', async () => {
    authSuccess(mockAuth)
    const video = { id: 'v1', title: 'Test Video' }
    mockFetchVideoById.mockResolvedValue(video as never)

    const res = await GET(createNextRequest('/api/content/videos/v1'), {
      params: Promise.resolve({ id: 'v1' }),
    })
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.read')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: video })
    expect(mockFetchVideoById).toHaveBeenCalledWith('v1')
  })

  it('returns 500 when fetch throws', async () => {
    authSuccess(mockAuth)
    mockFetchVideoById.mockRejectedValue(new Error('db down'))

    const res = await GET(createNextRequest('/api/content/videos/v1'), {
      params: Promise.resolve({ id: 'v1' }),
    })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('db down')
  })
})
