/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()

function jsonOk(data: unknown) {
  return {
    ok: true,
    json: async () => ({ success: true, data }),
  }
}

function jsonFail(error: string) {
  return {
    ok: true,
    json: async () => ({ success: false, error }),
  }
}

describe('clientContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function load() {
    return (await import('./content-client')).clientContentService
  }

  function mockCsrf() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        csrfToken: 'csrf-abc',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    })
  }

  it('fetchCategories / fetchDisciplines / fetchVideos / fetchVideoById', async () => {
    const svc = await load()
    mockFetch
      .mockResolvedValueOnce(jsonOk([{ id: 'c1' }]))
      .mockResolvedValueOnce(jsonOk([{ id: 'd1' }]))
      .mockResolvedValueOnce(jsonOk({ data: [{ id: 'v1' }], totalCount: 1, hasMore: false }))
      .mockResolvedValueOnce(jsonOk({ id: 'v1', title: 'Intro' }))

    await expect(svc.fetchCategories()).resolves.toEqual([{ id: 'c1' }])
    await expect(svc.fetchDisciplines()).resolves.toEqual([{ id: 'd1' }])
    await expect(
      svc.fetchVideos({ search: 'intro', categoryId: 'c1' }, { page: 1, pageSize: 10 })
    ).resolves.toMatchObject({ totalCount: 1 })
    await expect(svc.fetchVideoById('v1')).resolves.toEqual({ id: 'v1', title: 'Intro' })

    expect(mockFetch.mock.calls[2][0]).toContain('search=intro')
    expect(mockFetch.mock.calls[2][0]).toContain('categoryId=c1')
  })

  it('throws when GET endpoints fail', async () => {
    const svc = await load()
    mockFetch.mockResolvedValueOnce(jsonFail('no categories'))
    await expect(svc.fetchCategories()).rejects.toThrow('no categories')

    mockFetch.mockResolvedValueOnce(jsonFail('no disciplines'))
    await expect(svc.fetchDisciplines()).rejects.toThrow('no disciplines')

    mockFetch.mockResolvedValueOnce(jsonFail('no videos'))
    await expect(svc.fetchVideos()).rejects.toThrow('no videos')

    mockFetch.mockResolvedValueOnce(jsonFail('missing'))
    await expect(svc.fetchVideoById('x')).rejects.toThrow('missing')
  })

  it('discipline mutations use CSRF headers', async () => {
    const svc = await load()
    // First call fetches CSRF; subsequent calls reuse cache
    mockCsrf()
    mockFetch
      .mockResolvedValueOnce(jsonOk({ id: 'd1', name: 'Wrestling' }))
      .mockResolvedValueOnce(jsonOk({ id: 'd1', name: 'Updated' }))
      .mockResolvedValueOnce(jsonOk(null))

    await expect(svc.createDiscipline({ name: 'Wrestling', slug: 'wrestling' } as never)).resolves.toMatchObject({
      id: 'd1',
    })
    await expect(svc.updateDiscipline('d1', { name: 'Updated' } as never)).resolves.toMatchObject({
      name: 'Updated',
    })
    await expect(svc.deleteDiscipline('d1')).resolves.toBeUndefined()

    expect(mockFetch.mock.calls[0][0]).toBe('/api/csrf-token')
    expect(mockFetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-abc' }),
    })
  })

  it('category mutations and reorder/merge', async () => {
    const svc = await load()
    mockCsrf()
    mockFetch
      .mockResolvedValueOnce(jsonOk({ id: 'c1' }))
      .mockResolvedValueOnce(jsonOk({ id: 'c1', name: 'Renamed' }))
      .mockResolvedValueOnce(jsonOk(null))
      .mockResolvedValueOnce(jsonOk(null))
      .mockResolvedValueOnce(jsonOk(null))

    await svc.createCategory({ name: 'Cat', slug: 'cat', discipline_id: 'd1' } as never)
    await svc.updateCategory('c1', { name: 'Renamed' } as never)
    await svc.deleteCategory('c1')
    await svc.reorderCategories([{ id: 'c1', sort_order: 1 }])
    await svc.mergeCategories('target', ['src1'])

    const urls = mockFetch.mock.calls.map((c) => c[0])
    expect(urls).toContain('/api/content/categories/reorder')
    expect(urls).toContain('/api/content/categories/merge')
  })

  it('admin content actions', async () => {
    const svc = await load()
    mockCsrf()
    mockFetch
      .mockResolvedValueOnce(
        jsonOk({
          totalVideos: 1,
          totalDisciplines: 1,
          totalCategories: 1,
          publishedVideos: 1,
          processingVideos: 0,
          totalViewTime: 0,
          averageRating: 0,
        })
      )
      .mockResolvedValueOnce(jsonOk({ id: 'v1' }))
      .mockResolvedValueOnce(jsonOk({ id: 'v1', title: 'Y' }))
      .mockResolvedValueOnce(jsonOk(null))
      .mockResolvedValueOnce(jsonOk({ success: true, processed: 2, failed: 0, errors: [] }))
      .mockResolvedValueOnce(jsonOk({ success: true, processed: 1, failed: 0, errors: [] }))
      .mockResolvedValueOnce(jsonOk({ videoId: 'v1', viewCount: 10 }))

    await expect(svc.fetchContentStats()).resolves.toMatchObject({ totalVideos: 1 })
    await svc.createVideo({ title: 'X' } as never)
    await svc.updateVideo('v1', { title: 'Y' } as never)
    await svc.deleteVideo('v1')
    await svc.bulkUpdateVideoStatus(['v1', 'v2'], { is_published: true })
    await svc.bulkDeleteVideos(['v1'])
    await expect(svc.getVideoAnalytics('v1')).resolves.toMatchObject({ videoId: 'v1' })
  })

  it('CSRF failure and mutation error paths', async () => {
    const svc = await load()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    })
    await expect(svc.createDiscipline({ name: 'X', slug: 'x' } as never)).rejects.toThrow(
      /Failed to get CSRF token/
    )

    // Fresh module so CSRF cache is empty again
    vi.resetModules()
    const svc2 = (await import('./content-client')).clientContentService
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        csrfToken: 'csrf-2',
      }),
    })
    mockFetch.mockResolvedValueOnce(jsonFail('create failed'))
    await expect(svc2.createDiscipline({ name: 'X', slug: 'x' } as never)).rejects.toThrow(
      'create failed'
    )
  })
})
