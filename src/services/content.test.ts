/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  contentQueries,
  contentMutations,
  adminFeatures,
  contentSubscriptions,
  contentService,
} from './content'
import contentServiceDefault from './content'

vi.mock('../lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

const subscribeToTable = vi.fn((..._args: unknown[]) => 'sub-id')
const channelOn = vi.fn().mockReturnThis()
const channelSubscribe = vi.fn().mockReturnThis()
const channelUnsubscribe = vi.fn()
const mockChannel = {
  on: channelOn,
  subscribe: channelSubscribe,
  unsubscribe: channelUnsubscribe,
}
const createClientComponentClient = vi.fn(() => ({
  channel: vi.fn(() => mockChannel),
}))

vi.mock('../lib/supabase-browser', () => ({
  createClientComponentClient: (...args: unknown[]) =>
    (createClientComponentClient as (...a: unknown[]) => unknown)(...args),
}))

vi.mock('../lib/shared/services/realtime', () => ({
  RealtimeService: class {
    subscribeToTable = subscribeToTable
  },
}))

import { createAdminClient } from '../lib/supabase'

const mockCreateAdminClient = vi.mocked(createAdminClient)

function chainResolved(result: unknown) {
  const terminal = Promise.resolve(result)
  const builder: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'or',
    'order',
    'range',
    'ilike',
    'limit',
    'single',
  ]
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder)
  }
  // Make thenable so await works at any point
  Object.assign(builder, {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      terminal.then(resolve, reject),
  })
  return builder
}

describe('contentQueries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetchDisciplines returns empty array when data is null', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
    } as never)
    await expect(contentQueries.fetchDisciplines()).resolves.toEqual([])
  })

  it('fetchDisciplines returns data', async () => {
    const disciplines = [{ id: 'd1', name: 'Jiu Jitsu' }]
    const order = vi.fn().mockResolvedValue({ data: disciplines, error: null })
    const select = vi.fn().mockReturnValue({ order })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    const result = await contentQueries.fetchDisciplines(false)
    expect(result).toEqual(disciplines)
    expect(select).toHaveBeenCalledWith('*')
  })

  it('fetchDisciplines includes categories when requested', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn().mockReturnValue({ order })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    await contentQueries.fetchDisciplines(true)
    expect(select).toHaveBeenCalledWith(expect.stringContaining('categories(*)'))
  })

  it('fetchDisciplines throws on error', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
    } as never)

    await expect(contentQueries.fetchDisciplines()).rejects.toBeTruthy()
  })

  it('fetchCategories filters by discipline when provided', async () => {
    const categories = [{ id: 'c1', name: 'Basics' }]
    const eq = vi.fn().mockResolvedValue({ data: categories, error: null })
    const order = vi.fn().mockReturnValue({ eq })
    const select = vi.fn().mockReturnValue({ order })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    const result = await contentQueries.fetchCategories('d1', false)
    expect(result).toEqual(categories)
    expect(eq).toHaveBeenCalledWith('discipline_id', 'd1')
  })

  it('fetchCategories without discipline awaits base query', async () => {
    const categories = [{ id: 'c1' }]
    const order = vi.fn().mockResolvedValue({ data: categories, error: null })
    const select = vi.fn().mockReturnValue({ order })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    await expect(contentQueries.fetchCategories(undefined, true)).resolves.toEqual(categories)
    expect(select).toHaveBeenCalledWith(expect.stringContaining('videos(*)'))
  })

  it('fetchVideos returns paginated result with filters', async () => {
    const videos = [{ id: 'v1', title: 'Intro' }]
    const query = chainResolved({ data: videos, error: null, count: 25 })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as never)

    const result = await contentQueries.fetchVideos(
      {
        search: 'intro',
        categoryId: 'c1',
        subscriptionTier: 'tier1',
        difficulty: 'tier1',
        processingStatus: 'ready',
        isPublished: true,
      },
      { page: 2, pageSize: 10, orderBy: 'title', orderDirection: 'asc' }
    )
    expect(result.data).toEqual(videos)
    expect(result.totalCount).toBe(25)
    expect(result.hasMore).toBe(true)
    expect(query.or).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('category_id', 'c1')
    expect(query.eq).toHaveBeenCalledWith('tier_required', 'tier1')
  })

  it('fetchVideos throws on error', async () => {
    const query = chainResolved({
      data: null,
      error: { code: 'XX', message: 'boom', details: '', hint: '' },
      count: 0,
    })
    mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never)
    await expect(contentQueries.fetchVideos()).rejects.toBeTruthy()
  })

  it('fetchVideoById returns null for PGRST116 and data otherwise', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    expect(await contentQueries.fetchVideoById('missing')).toBeNull()

    single.mockResolvedValueOnce({ data: { id: 'v1' }, error: null })
    expect(await contentQueries.fetchVideoById('v1')).toEqual({ id: 'v1' })

    single.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    await expect(contentQueries.fetchVideoById('bad')).rejects.toBeTruthy()
  })

  it('fetchInstructors returns active instructors', async () => {
    const instructors = [{ id: 'i1', full_name: 'Coach' }]
    const order = vi.fn().mockResolvedValue({ data: instructors, error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never)

    await expect(contentQueries.fetchInstructors()).resolves.toEqual(instructors)
    expect(eq).toHaveBeenCalledWith('is_active', true)
  })

  it('fetchInstructors throws on error', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
      }),
    } as never)
    await expect(contentQueries.fetchInstructors()).rejects.toBeTruthy()
  })

  it('fetchContentStats aggregates counts', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => {
          const result = Promise.resolve({ count: 5, error: null })
          return Object.assign(result, {
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          })
        }),
      })),
    } as never)

    const stats = await contentQueries.fetchContentStats()
    expect(stats).toMatchObject({
      totalDisciplines: 5,
      totalCategories: 5,
      totalVideos: 5,
      publishedVideos: 2,
      processingVideos: 2,
      totalViewTime: 0,
      averageRating: 0,
    })
  })
})

describe('contentMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createVideo applies defaults for optional fields', async () => {
    const created = { id: 'cf-2', title: 'Minimal' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    } as never)

    await contentMutations.createVideo({
      id: 'cf-2',
      title: 'Minimal',
      slug: 'minimal',
      categoryId: 'cat-1',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
        instructor_id: null,
        duration_seconds: 0,
        thumbnail_url: null,
        tier_required: 'none',
        tags: null,
        processing_status: 'processing',
        is_published: false,
        view_count: 0,
        sort_order: 0,
      })
    )
  })

  it('createVideo transforms camelCase and inserts', async () => {
    const created = { id: 'cf-1', title: 'Test' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    } as never)

    const result = await contentMutations.createVideo({
      id: 'cf-1',
      title: 'Test',
      slug: 'test',
      categoryId: 'cat-1',
      subscriptionTier: 'tier1',
    })

    expect(result).toEqual(created)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-1',
        cloudflare_video_id: 'cf-1',
        tier_required: 'tier1',
      })
    )
  })

  it('createVideo throws on insert error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'dup', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
      }),
    } as never)
    await expect(
      contentMutations.createVideo({
        id: 'x',
        title: 't',
        slug: 's',
        categoryId: 'c',
      })
    ).rejects.toBeTruthy()
  })

  it('updateVideo updates by id', async () => {
    const updated = { id: 'v1', title: 'Updated' }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update }),
    } as never)

    const result = await contentMutations.updateVideo('v1', { title: 'Updated' })
    expect(result).toEqual(updated)
    expect(eq).toHaveBeenCalledWith('id', 'v1')
  })

  it('updateVideo throws on error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        }),
      }),
    } as never)
    await expect(contentMutations.updateVideo('v1', { title: 'X' })).rejects.toBeTruthy()
  })

  it('deleteVideo cleans up progress then deletes video', async () => {
    const progressEq = vi.fn().mockResolvedValue({ error: null })
    const videoEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return { delete: vi.fn().mockReturnValue({ eq: progressEq }) }
        }
        if (table === 'videos') {
          return { delete: vi.fn().mockReturnValue({ eq: videoEq }) }
        }
        return {}
      }),
    } as never)

    await contentMutations.deleteVideo('v1')
    expect(progressEq).toHaveBeenCalledWith('video_id', 'v1')
    expect(videoEq).toHaveBeenCalledWith('id', 'v1')
  })

  it('deleteVideo throws when progress cleanup fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { code: 'XX', message: 'progress fail', details: '', hint: '' },
          }),
        }),
      })),
    } as never)
    await expect(contentMutations.deleteVideo('v1')).rejects.toThrow(/cleanup user progress/)
  })

  it('createCategory inserts category', async () => {
    const created = { id: 'c1', name: 'Cat', slug: 'cat' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    } as never)

    const result = await contentMutations.createCategory({
      name: 'Cat',
      slug: 'cat',
      discipline_id: 'd1',
      color: '#2563EB',
      subscription_tier_required: 'none',
    })
    expect(result).toEqual(created)
  })

  it('updateCategory and deleteCategory success and guard paths', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'c1', name: 'U' }, error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        }),
      }),
    } as never)
    await expect(contentMutations.updateCategory('c1', { name: 'U' })).resolves.toMatchObject({
      id: 'c1',
    })

    // cannot delete with videos
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ id: 'v1' }], error: null }),
            }),
          }
        }
        return {}
      }),
    } as never)
    await expect(contentMutations.deleteCategory('c1')).rejects.toThrow(/existing videos/)

    // successful delete
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return { delete: vi.fn().mockReturnValue({ eq: deleteEq }) }
      }),
    } as never)
    await contentMutations.deleteCategory('c1')
    expect(deleteEq).toHaveBeenCalledWith('id', 'c1')
  })

  it('createDiscipline / updateDiscipline / deleteDiscipline', async () => {
    const created = { id: 'd1', name: 'Wrestling', slug: 'wrestling' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        }),
      }),
    } as never)

    await expect(
      contentMutations.createDiscipline({
        name: 'Wrestling',
        slug: 'wrestling',
        color: '#2563EB',
        subscription_tier_required: 'none',
      })
    ).resolves.toEqual(created)
    await expect(contentMutations.updateDiscipline('d1', { name: 'W' })).resolves.toEqual(created)

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }], error: null }),
            }),
          }
        }
        return {}
      }),
    } as never)
    await expect(contentMutations.deleteDiscipline('d1')).rejects.toThrow(/existing categories/)

    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return { delete: vi.fn().mockReturnValue({ eq: deleteEq }) }
      }),
    } as never)
    await contentMutations.deleteDiscipline('d1')
    expect(deleteEq).toHaveBeenCalledWith('id', 'd1')
  })

  it('mergeCategories moves videos and deletes sources', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const deleteIn = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ in: deleteIn })

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'videos') return { update }
        if (table === 'categories') return { delete: del }
        return {}
      }),
    } as never)

    await contentMutations.mergeCategories('target', ['src1', 'src2'])
    expect(updateEq).toHaveBeenCalledTimes(2)
    expect(deleteIn).toHaveBeenCalledWith('id', ['src1', 'src2'])
  })

  it('splitCategory creates categories and moves videos', async () => {
    const source = { id: 'src', discipline_id: 'd1', sort_order: 1 }
    const created = { id: 'new1', name: 'Part A' }
    const singleFetch = vi.fn().mockResolvedValue({ data: source, error: null })
    const singleInsert = vi.fn().mockResolvedValue({ data: created, error: null })
    const moveIn = vi.fn().mockResolvedValue({ error: null })

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: singleFetch }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: singleInsert }),
            }),
          }
        }
        if (table === 'videos') {
          return {
            update: vi.fn().mockReturnValue({ in: moveIn }),
          }
        }
        return {}
      }),
    } as never)

    const result = await contentMutations.splitCategory('src', [
      { name: 'Part A', slug: 'part-a', videoIds: ['v1', 'v2'] },
    ])
    expect(result).toEqual([created])
    expect(moveIn).toHaveBeenCalledWith('id', ['v1', 'v2'])
  })

  it('reorderContent updates sort_order for each item', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update }),
    } as never)

    await contentMutations.reorderContent('categories', [
      { id: 'c1', sort_order: 1 },
      { id: 'c2', sort_order: 2 },
    ])
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('reorderContent throws when updates reject', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error('fail')),
        }),
      }),
    } as never)
    await expect(
      contentMutations.reorderContent('videos', [{ id: 'v1', sort_order: 1 }])
    ).rejects.toThrow(/Failed to reorder/)
  })
})

describe('adminFeatures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bulkUpdateVideoStatus counts processed and failed', async () => {
    let call = 0
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(async () => {
            call++
            if (call === 2) {
              return { error: { code: 'XX', message: 'nope', details: '', hint: '' } }
            }
            return { error: null }
          }),
        }),
      }),
    } as never)

    const result = await adminFeatures.bulkUpdateVideoStatus(['a', 'b', 'c'], {
      is_published: true,
    })
    expect(result.processed).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.success).toBe(false)
  })

  it('bulkDeleteVideos aggregates delete results', async () => {
    const progressEq = vi.fn().mockResolvedValue({ error: null })
    const videoEq = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { code: 'XX', message: 'fail', details: '', hint: '' },
      })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return { delete: vi.fn().mockReturnValue({ eq: progressEq }) }
        }
        return { delete: vi.fn().mockReturnValue({ eq: videoEq }) }
      }),
    } as never)

    const result = await adminFeatures.bulkDeleteVideos(['v1', 'v2'])
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('getVideoAnalytics computes completion metrics', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'v1',
        title: 'Intro',
        view_count: 10,
        user_progress: [
          { completed: true, progress_percentage: 100, user_id: 'u1' },
          { completed: false, progress_percentage: 50, user_id: 'u2' },
        ],
      },
      error: null,
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
      }),
    } as never)

    const analytics = await adminFeatures.getVideoAnalytics('v1')
    expect(analytics.completionRate).toBe(50)
    expect(analytics.averageWatchTime).toBe(75)
    expect(analytics.videoId).toBe('v1')
  })

  it('searchContent queries all content types', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        const data =
          table === 'disciplines'
            ? [{ id: 'd1' }]
            : table === 'categories'
              ? [{ id: 'c1' }]
              : [{ id: 'v1' }]
        return chainResolved({ data, error: null })
      }),
    } as never)

    const result = await adminFeatures.searchContent('guard')
    expect(result.disciplines).toHaveLength(1)
    expect(result.categories).toHaveLength(1)
    expect(result.videos).toHaveLength(1)
  })
})

describe('contentSubscriptions and service export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('subscribeToVideoProcessing wires realtime callback', () => {
    const cb = vi.fn()
    const id = contentSubscriptions.subscribeToVideoProcessing(cb)
    expect(id).toBe('sub-id')
    expect(subscribeToTable).toHaveBeenCalledWith('videos', expect.any(Function))

    const handler = subscribeToTable.mock.calls[0]?.[1] as unknown as (payload: unknown) => void
    handler({
      eventType: 'UPDATE',
      new: { id: 'v1', processing_status: 'ready' },
      old: { processing_status: 'processing' },
    })
    expect(cb).toHaveBeenCalledWith({ id: 'v1', processing_status: 'ready' })

    handler({
      eventType: 'UPDATE',
      new: { id: 'v1', processing_status: 'ready' },
      old: { processing_status: 'ready' },
    })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('subscribeToContentChanges returns unsubscribe handle', () => {
    const cb = vi.fn()
    const handle = contentSubscriptions.subscribeToContentChanges(cb)
    expect(createClientComponentClient).toHaveBeenCalled()
    expect(channelOn).toHaveBeenCalled()
    handle.unsubscribe()
    expect(channelUnsubscribe).toHaveBeenCalled()
  })

  it('contentService aggregates modules', () => {
    expect(contentService.queries).toBe(contentQueries)
    expect(contentService.mutations).toBe(contentMutations)
    expect(contentService.admin).toBe(adminFeatures)
    expect(contentService.subscriptions).toBe(contentSubscriptions)
    expect(contentServiceDefault).toBe(contentService)
  })

  it('subscribeToVideoProcessing ignores non-status-change payloads', () => {
    const cb = vi.fn()
    contentSubscriptions.subscribeToVideoProcessing(cb)
    const handler = subscribeToTable.mock.calls[0]?.[1] as unknown as (payload: unknown) => void

    handler({ eventType: 'INSERT', new: { id: 'v1', processing_status: 'ready' } })
    handler({ eventType: 'UPDATE', old: { processing_status: 'processing' } })
    expect(cb).not.toHaveBeenCalled()
  })

  it('subscribeToVideoProcessing uses browser client when window is defined', () => {
    vi.stubGlobal('window', {})
    try {
      contentSubscriptions.subscribeToVideoProcessing(vi.fn())
      expect(createClientComponentClient).toHaveBeenCalled()
      expect(subscribeToTable).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('additional error and edge paths', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetchCategories throws on supabase error', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'cat fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
    } as never)
    await expect(contentQueries.fetchCategories()).rejects.toBeTruthy()
  })

  it('fetchVideos returns empty data and hasMore false when count is low', async () => {
    const query = chainResolved({ data: null, error: null, count: 0 })
    mockCreateAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never)
    const result = await contentQueries.fetchVideos()
    expect(result.data).toEqual([])
    expect(result.totalCount).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('fetchInstructors returns empty array when data is null', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
      }),
    } as never)
    await expect(contentQueries.fetchInstructors()).resolves.toEqual([])
  })

  it('deleteVideo throws when video delete fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'user_progress') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { code: 'XX', message: 'video fail', details: '', hint: '' },
            }),
          }),
        }
      }),
    } as never)
    await expect(contentMutations.deleteVideo('v1')).rejects.toBeTruthy()
  })

  it('createDiscipline throws on insert error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'dup', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
      }),
    } as never)
    await expect(
      contentMutations.createDiscipline({
        name: 'X',
        slug: 'x',
        color: '#2563EB',
        subscription_tier_required: 'none',
      })
    ).rejects.toBeTruthy()
  })

  it('updateDiscipline throws on update error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        }),
      }),
    } as never)
    await expect(contentMutations.updateDiscipline('d1', { name: 'Y' })).rejects.toBeTruthy()
  })

  it('deleteDiscipline throws when category check fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'XX', message: 'check fail', details: '', hint: '' },
          }),
        }),
      }),
    } as never)
    await expect(contentMutations.deleteDiscipline('d1')).rejects.toThrow(/Failed to check categories/)
  })

  it('deleteDiscipline throws when discipline delete fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { code: 'XX', message: 'del fail', details: '', hint: '' },
            }),
          }),
        }
      }),
    } as never)
    await expect(contentMutations.deleteDiscipline('d1')).rejects.toBeTruthy()
  })

  it('createCategory throws on insert error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
      }),
    } as never)
    await expect(
      contentMutations.createCategory({
        name: 'C',
        slug: 'c',
        discipline_id: 'd1',
        color: '#2563EB',
        subscription_tier_required: 'none',
      })
    ).rejects.toBeTruthy()
  })

  it('updateCategory throws on update error', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX', message: 'fail', details: '', hint: '' },
    })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        }),
      }),
    } as never)
    await expect(contentMutations.updateCategory('c1', { name: 'Z' })).rejects.toBeTruthy()
  })

  it('deleteCategory throws when video check fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'XX', message: 'check fail', details: '', hint: '' },
          }),
        }),
      }),
    } as never)
    await expect(contentMutations.deleteCategory('c1')).rejects.toThrow(/Failed to check videos/)
  })

  it('deleteCategory throws when category delete fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { code: 'XX', message: 'del fail', details: '', hint: '' },
            }),
          }),
        }
      }),
    } as never)
    await expect(contentMutations.deleteCategory('c1')).rejects.toBeTruthy()
  })

  it('mergeCategories throws when moving videos fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { code: 'XX', message: 'move fail', details: '', hint: '' },
          }),
        }),
      }),
    } as never)
    await expect(contentMutations.mergeCategories('t', ['s1'])).rejects.toThrow(
      /Failed to move videos/
    )
  })

  it('mergeCategories throws when deleting sources fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'videos') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              error: { code: 'XX', message: 'del fail', details: '', hint: '' },
            }),
          }),
        }
      }),
    } as never)
    await expect(contentMutations.mergeCategories('t', ['s1'])).rejects.toThrow(
      /Failed to delete source categories/
    )
  })

  it('splitCategory throws when source fetch fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'XX', message: 'missing', details: '', hint: '' },
            }),
          }),
        }),
      }),
    } as never)
    await expect(
      contentMutations.splitCategory('src', [{ name: 'A', slug: 'a', videoIds: [] }])
    ).rejects.toThrow(/Failed to fetch source category/)
  })

  it('splitCategory throws when create fails', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'src', discipline_id: 'd1', sort_order: 0 },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'XX', message: 'create fail', details: '', hint: '' },
            }),
          }),
        }),
      }),
    } as never)
    await expect(
      contentMutations.splitCategory('src', [{ name: 'A', slug: 'a', videoIds: [] }])
    ).rejects.toThrow(/Failed to create category/)
  })

  it('splitCategory skips video move when videoIds empty and throws on move error', async () => {
    const created = { id: 'new1', name: 'Part A' }
    const singleInsert = vi
      .fn()
      .mockResolvedValueOnce({ data: created, error: null })
      .mockResolvedValueOnce({ data: { id: 'new2', name: 'Part B' }, error: null })
    const moveIn = vi.fn().mockResolvedValue({
      error: { code: 'XX', message: 'move fail', details: '', hint: '' },
    })

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'src', discipline_id: 'd1', sort_order: 1 },
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: singleInsert }),
            }),
          }
        }
        return { update: vi.fn().mockReturnValue({ in: moveIn }) }
      }),
    } as never)

    // empty videoIds — no move
    const result = await contentMutations.splitCategory('src', [
      { name: 'Part A', slug: 'part-a', videoIds: [] },
    ])
    expect(result).toEqual([created])
    expect(moveIn).not.toHaveBeenCalled()

    // move error
    await expect(
      contentMutations.splitCategory('src', [
        { name: 'Part B', slug: 'part-b', videoIds: ['v1'] },
      ])
    ).rejects.toThrow(/Failed to move videos/)
  })

  it('getVideoAnalytics throws on video error and handles empty progress', async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'XX', message: 'missing', details: '', hint: '' },
      })
      .mockResolvedValueOnce({
        data: { id: 'v2', title: 'Empty', view_count: 0, user_progress: null },
        error: null,
      })
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
      }),
    } as never)

    await expect(adminFeatures.getVideoAnalytics('missing')).rejects.toBeTruthy()

    const analytics = await adminFeatures.getVideoAnalytics('v2')
    expect(analytics.completionRate).toBe(0)
    expect(analytics.averageWatchTime).toBe(0)
    expect(analytics.subscriberTierBreakdown.none).toBe(0)
  })

  it('bulkUpdateVideoStatus succeeds fully and captures thrown errors', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as never)
    const ok = await adminFeatures.bulkUpdateVideoStatus(['a'], { processing_status: 'ready' })
    expect(ok).toMatchObject({ success: true, processed: 1, failed: 0 })

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            throw new Error('network')
          }),
        }),
      }),
    } as never)
    const failed = await adminFeatures.bulkUpdateVideoStatus(['b'], { is_published: false })
    expect(failed.failed).toBe(1)
    expect(failed.errors[0]).toMatch(/network/)

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            throw 'string-fail'
          }),
        }),
      }),
    } as never)
    const unknown = await adminFeatures.bulkUpdateVideoStatus(['c'], { is_published: true })
    expect(unknown.errors[0]).toMatch(/Unknown error/)
  })

  it('bulkDeleteVideos reports full success', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    } as never)
    const result = await adminFeatures.bulkDeleteVideos(['v1'])
    expect(result).toMatchObject({ success: true, processed: 1, failed: 0 })
  })

  it('searchContent returns empty arrays when data is null', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => chainResolved({ data: null, error: null })),
    } as never)
    const result = await adminFeatures.searchContent('nothing')
    expect(result).toEqual({ disciplines: [], categories: [], videos: [] })
  })
})

describe('browser environment guards', () => {
  const guards: Array<{
    name: string
    run: () => Promise<unknown>
  }> = [
    {
      name: 'fetchContentStats',
      run: () => contentQueries.fetchContentStats(),
    },
    {
      name: 'createVideo',
      run: () =>
        contentMutations.createVideo({
          id: 'x',
          title: 't',
          slug: 's',
          categoryId: 'c',
        }),
    },
    {
      name: 'updateVideo',
      run: () => contentMutations.updateVideo('v1', { title: 't' }),
    },
    {
      name: 'deleteVideo',
      run: () => contentMutations.deleteVideo('v1'),
    },
    {
      name: 'createDiscipline',
      run: () =>
        contentMutations.createDiscipline({
          name: 'n',
          slug: 's',
          color: '#2563EB',
          subscription_tier_required: 'none',
        }),
    },
    {
      name: 'updateDiscipline',
      run: () => contentMutations.updateDiscipline('d1', { name: 'n' }),
    },
    {
      name: 'deleteDiscipline',
      run: () => contentMutations.deleteDiscipline('d1'),
    },
    {
      name: 'createCategory',
      run: () =>
        contentMutations.createCategory({
          name: 'n',
          slug: 's',
          discipline_id: 'd1',
          color: '#2563EB',
          subscription_tier_required: 'none',
        }),
    },
    {
      name: 'updateCategory',
      run: () => contentMutations.updateCategory('c1', { name: 'n' }),
    },
    {
      name: 'deleteCategory',
      run: () => contentMutations.deleteCategory('c1'),
    },
    {
      name: 'mergeCategories',
      run: () => contentMutations.mergeCategories('t', ['s']),
    },
    {
      name: 'splitCategory',
      run: () =>
        contentMutations.splitCategory('src', [{ name: 'A', slug: 'a', videoIds: [] }]),
    },
    {
      name: 'reorderContent',
      run: () => contentMutations.reorderContent('videos', [{ id: 'v1', sort_order: 1 }]),
    },
    {
      name: 'bulkUpdateVideoStatus',
      run: () => adminFeatures.bulkUpdateVideoStatus(['v1'], { is_published: true }),
    },
    {
      name: 'bulkDeleteVideos',
      run: () => adminFeatures.bulkDeleteVideos(['v1']),
    },
    {
      name: 'getVideoAnalytics',
      run: () => adminFeatures.getVideoAnalytics('v1'),
    },
  ]

  for (const { name, run } of guards) {
    it(`${name} throws in browser environment`, async () => {
      vi.stubGlobal('window', {})
      try {
        await expect(run()).rejects.toThrow(/cannot be used in browser environment/)
      } finally {
        vi.unstubAllGlobals()
      }
    })
  }
})
