import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { GET as GETHandler, POST as POSTHandler } from './videos'

const GET = (request?: Request) => GETHandler({ request: request ?? new Request('http://localhost/') } as never)
const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)

vi.mock('@/src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('@/src/services/content', () => ({
  contentQueries: {
    fetchVideos: vi.fn(),
  },
  contentMutations: {
    createVideo: vi.fn(),
    updateVideo: vi.fn(),
  },
}))

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { contentQueries, contentMutations } from '@/src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchVideos = vi.mocked(contentQueries.fetchVideos)
const mockCreateVideo = vi.mocked(contentMutations.createVideo)
const mockUpdateVideo = vi.mocked(contentMutations.updateVideo)


describe('GET /api/content/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth error when session validation fails', async () => {
    authFail(mockAuth, 401)
    const req = createNextRequest('/api/content/videos')
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(mockFetchVideos).not.toHaveBeenCalled()
  })

  it('returns videos on success', async () => {
    authSuccess(mockAuth)
    const payload = { data: [{ id: 'v1', title: 'Test' }], totalCount: 1, hasMore: false }
    mockFetchVideos.mockResolvedValue(payload as never)

    const req = createNextRequest('/api/content/videos?search=foo&categoryId=cat-1')
    const res = await GET(req)
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.read')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: payload })
    expect(mockFetchVideos).toHaveBeenCalledWith(
      { search: 'foo', categoryId: 'cat-1' },
      expect.objectContaining({ page: 1, pageSize: 100, orderBy: 'created_at', orderDirection: 'desc' })
    )
  })

  it('returns 500 when fetchVideos throws', async () => {
    authSuccess(mockAuth)
    mockFetchVideos.mockRejectedValue(new Error('db down'))

    const res = await GET(createNextRequest('/api/content/videos'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'db down' })
  })
})

describe('POST /api/content/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns auth error when session validation fails', async () => {
    authFail(mockAuth, 403)
    const req = createNextRequest('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', videoData: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('creates a video', async () => {
    authSuccess(mockAuth)
    const video = { id: 'v1', title: 'New Video' }
    mockCreateVideo.mockResolvedValue(video as never)

    const req = createNextRequest('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        videoData: { id: 'v1', title: 'New Video', slug: 'new', categoryId: 'c1' },
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: video })
    expect(mockCreateVideo).toHaveBeenCalled()
  })

  it('updates a video', async () => {
    authSuccess(mockAuth)
    const updated = { id: 'v1', title: 'Updated' }
    mockUpdateVideo.mockResolvedValue(updated as never)

    const req = createNextRequest('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        id: 'v1',
        updateData: { title: 'Updated' },
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: updated })
    expect(mockUpdateVideo).toHaveBeenCalledWith('v1', { title: 'Updated' })
  })

  it('returns 400 for invalid action', async () => {
    authSuccess(mockAuth)
    const req = createNextRequest('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'Invalid action' })
  })

  it('returns 500 when mutation throws', async () => {
    authSuccess(mockAuth)
    mockCreateVideo.mockRejectedValue(new Error('insert failed'))

    const req = createNextRequest('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', videoData: { id: 'v1' } }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'insert failed' })
  })
})
