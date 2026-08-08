/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

import {
  queryKeys,
  createQueryClient,
  getQueryClient,
  staleTimeConfig,
  QueryErrorBoundary,
  optimisticUpdates,
  cacheUtils,
  realtimeUtils,
  devUtils,
} from './query-client'

describe('queryKeys', () => {
  it('builds hierarchical base and content keys', () => {
    expect(queryKeys.all).toEqual(['evolution-combatives'])
    expect(queryKeys.content()).toEqual(['evolution-combatives', 'content'])
    expect(queryKeys.contentStats()).toEqual(['evolution-combatives', 'content', 'stats'])
  })

  it('builds discipline keys', () => {
    expect(queryKeys.disciplines()).toEqual(['evolution-combatives', 'content', 'disciplines'])
    expect(queryKeys.disciplinesList(true)).toEqual([
      'evolution-combatives',
      'content',
      'disciplines',
      'list',
      { includeCategories: true },
    ])
    expect(queryKeys.disciplineDetail('d1')).toEqual([
      'evolution-combatives',
      'content',
      'disciplines',
      'detail',
      'd1',
    ])
  })

  it('builds category keys', () => {
    expect(queryKeys.categories()).toEqual(['evolution-combatives', 'content', 'categories'])
    expect(queryKeys.categoriesList('d1', true)).toEqual([
      'evolution-combatives',
      'content',
      'categories',
      'list',
      { disciplineId: 'd1', includeVideos: true },
    ])
    expect(queryKeys.categoryDetail('c1')).toEqual([
      'evolution-combatives',
      'content',
      'categories',
      'detail',
      'c1',
    ])
  })

  it('builds video keys', () => {
    const filters = { search: 'guard' }
    const pagination = { page: 1, pageSize: 20 }
    expect(queryKeys.videos()).toEqual(['evolution-combatives', 'content', 'videos'])
    expect(queryKeys.videosList(filters, pagination)).toEqual([
      'evolution-combatives',
      'content',
      'videos',
      'list',
      { filters, pagination },
    ])
    expect(queryKeys.videoDetail('v1')).toEqual([
      'evolution-combatives',
      'content',
      'videos',
      'detail',
      'v1',
    ])
    expect(queryKeys.videoAnalytics('v1')).toEqual([
      'evolution-combatives',
      'content',
      'videos',
      'analytics',
      'v1',
    ])
  })

  it('builds instructor, user, stream, search, and subscription keys', () => {
    expect(queryKeys.instructors()).toEqual(['evolution-combatives', 'content', 'instructors'])
    expect(queryKeys.instructorsList()).toEqual([
      'evolution-combatives',
      'content',
      'instructors',
      'list',
    ])
    expect(queryKeys.instructorDetail('i1')).toEqual([
      'evolution-combatives',
      'content',
      'instructors',
      'detail',
      'i1',
    ])

    expect(queryKeys.users()).toEqual(['evolution-combatives', 'users'])
    expect(queryKeys.usersList(2, 25)).toEqual([
      'evolution-combatives',
      'users',
      'list',
      { page: 2, pageSize: 25 },
    ])
    expect(queryKeys.userDetail('u1')).toEqual(['evolution-combatives', 'users', 'detail', 'u1'])
    expect(queryKeys.userProfile()).toEqual(['evolution-combatives', 'users', 'profile'])

    expect(queryKeys.stream()).toEqual(['evolution-combatives', 'stream'])
    expect(queryKeys.streamVideo('s1')).toEqual(['evolution-combatives', 'stream', 'video', 's1'])
    expect(queryKeys.streamUpload('up1')).toEqual(['evolution-combatives', 'stream', 'upload', 'up1'])

    expect(queryKeys.search('guard', 'videos')).toEqual([
      'evolution-combatives',
      'search',
      { query: 'guard', type: 'videos' },
    ])
    expect(queryKeys.subscriptions()).toEqual(['evolution-combatives', 'subscriptions'])
  })
})

describe('staleTimeConfig', () => {
  it('exposes expected stale times', () => {
    expect(staleTimeConfig.static).toBe(1000 * 60 * 60)
    expect(staleTimeConfig.content).toBe(1000 * 60 * 20)
    expect(staleTimeConfig.users).toBe(1000 * 60 * 15)
    expect(staleTimeConfig.realtime).toBe(1000 * 30)
    expect(staleTimeConfig.analytics).toBe(1000 * 60 * 10)
    expect(staleTimeConfig.processing).toBe(1000 * 10)
    expect(staleTimeConfig.search).toBe(1000 * 60 * 2)
  })
})

describe('createQueryClient / getQueryClient', () => {
  it('creates a client with retry defaults that skip 4xx', () => {
    const client = createQueryClient()
    const defaults = client.getDefaultOptions()
    const queryRetry = defaults.queries?.retry as (count: number, error: unknown) => boolean
    const mutationRetry = defaults.mutations?.retry as (count: number, error: unknown) => boolean

    expect(queryRetry(0, { status: 404 })).toBe(false)
    expect(queryRetry(1, { status: 500 })).toBe(true)
    expect(queryRetry(3, { status: 500 })).toBe(false)

    expect(mutationRetry(0, { status: 400 })).toBe(false)
    expect(mutationRetry(0, { status: 500 })).toBe(true)
    expect(mutationRetry(1, { status: 500 })).toBe(false)

    const retryDelay = defaults.queries?.retryDelay as (attempt: number) => number
    expect(retryDelay(0)).toBe(1000)
    expect(retryDelay(10)).toBe(30000)
  })

  it('returns singleton on client and new instance on server', () => {
    const first = getQueryClient()
    const second = getQueryClient()
    expect(first).toBe(second)

    const originalWindow = globalThis.window
    // Simulate server by temporarily removing window
    // @ts-expect-error intentional for server branch
    delete globalThis.window
    const serverA = getQueryClient()
    const serverB = getQueryClient()
    expect(serverA).not.toBe(serverB)
    globalThis.window = originalWindow
  })
})

describe('QueryErrorBoundary', () => {
  beforeEach(() => {
    toastError.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps known error messages to toast copy', () => {
    QueryErrorBoundary.handleError({ message: 'Failed to fetch' }, ['videos'])
    expect(toastError).toHaveBeenCalledWith(
      'Network error. Please check your connection.',
      expect.any(Object)
    )

    toastError.mockClear()
    QueryErrorBoundary.handleError({ message: 'Authentication expired' }, ['users'])
    expect(toastError).toHaveBeenCalledWith(
      'Your session has expired. Please sign in again.',
      expect.any(Object)
    )

    toastError.mockClear()
    QueryErrorBoundary.handleError({ message: 'Permission denied' }, ['users'])
    expect(toastError).toHaveBeenCalledWith(
      'You do not have permission to access this data.',
      expect.any(Object)
    )

    toastError.mockClear()
    QueryErrorBoundary.handleError({ status: 429 }, ['videos'])
    expect(toastError).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment and try again.',
      expect.any(Object)
    )

    toastError.mockClear()
    QueryErrorBoundary.handleError({ status: 503 }, ['videos'])
    expect(toastError).toHaveBeenCalledWith('Server error. Please try again later.', expect.any(Object))
  })
})

describe('optimisticUpdates', () => {
  let client: QueryClient

  beforeEach(() => {
    client = createQueryClient()
  })

  it('updates, adds, and removes videos in list cache', () => {
    const key = queryKeys.videosList()
    client.setQueryData(key, {
      data: [{ id: 'v1', title: 'A' }, { id: 'v2', title: 'B' }],
      totalCount: 2,
      hasMore: false,
    })

    optimisticUpdates.updateVideoInList(client, 'v1', (v) => ({ ...v, title: 'Updated' }))
    expect(client.getQueryData(key)).toMatchObject({
      data: [{ id: 'v1', title: 'Updated' }, { id: 'v2', title: 'B' }],
    })

    optimisticUpdates.addVideoToList(client, { id: 'v3', title: 'C' } as never)
    expect(client.getQueryData(key)).toMatchObject({ totalCount: 3 })

    optimisticUpdates.removeVideoFromList(client, 'v2')
    const after = client.getQueryData(key) as { data: { id: string }[]; totalCount: number }
    expect(after.data.map((v) => v.id)).toEqual(['v3', 'v1'])
    expect(after.totalCount).toBe(2)

    // No-op when cached value has no data array
    client.setQueryData(key, { totalCount: 0, hasMore: false } as never)
    optimisticUpdates.updateVideoInList(client, 'v1', (v) => ({ ...v, title: 'nope' }))
    optimisticUpdates.addVideoToList(client, { id: 'x' } as never)
    optimisticUpdates.removeVideoFromList(client, 'x')
    expect(client.getQueryData(key)).toEqual({ totalCount: 0, hasMore: false })
  })
})

describe('cacheUtils', () => {
  it('invalidates content, videos, users, and clears all', async () => {
    const client = createQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)
    const clearSpy = vi.spyOn(client, 'clear').mockImplementation(() => {})

    await cacheUtils.invalidateContent(client)
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.content() })

    await cacheUtils.invalidateVideo(client)
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.videos() })

    await cacheUtils.invalidateVideo(client, 'v1')
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.videoDetail('v1') })

    await cacheUtils.invalidateUsers(client)
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.users() })

    await cacheUtils.invalidateUsers(client, 'u1')
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.userDetail('u1') })

    cacheUtils.clearAll(client)
    expect(clearSpy).toHaveBeenCalled()
  })
})

describe('realtimeUtils', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
  })

  it('handles video processing updates and content table changes', () => {
    const client = createQueryClient()
    client.setQueryData(queryKeys.videoDetail('v1'), { id: 'v1', processing_status: 'processing' })
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    realtimeUtils.handleVideoProcessingUpdate(client, { id: 'v1', processing_status: 'ready' })
    expect(client.getQueryData(queryKeys.videoDetail('v1'))).toMatchObject({
      processing_status: 'ready',
    })
    expect(toastSuccess).toHaveBeenCalled()

    realtimeUtils.handleVideoProcessingUpdate(client, { id: 'v1', processing_status: 'error' })
    expect(toastError).toHaveBeenCalled()

    realtimeUtils.handleContentChange(client, { table: 'videos', eventType: 'UPDATE' })
    realtimeUtils.handleContentChange(client, { table: 'categories', eventType: 'INSERT' })
    realtimeUtils.handleContentChange(client, { table: 'disciplines', eventType: 'DELETE' })
    realtimeUtils.handleContentChange(client, { table: 'instructors', eventType: 'UPDATE' })
    expect(invalidate).toHaveBeenCalled()
  })
})

describe('devUtils', () => {
  it('logQueries and clearPattern only act in development', () => {
    const client = createQueryClient()
    client.setQueryData(queryKeys.videos(), [])
    const table = vi.spyOn(console, 'table').mockImplementation(() => {})
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined)

    vi.stubEnv('NODE_ENV', 'development')
    devUtils.logQueries(client)
    expect(table).toHaveBeenCalled()
    devUtils.clearPattern(client, 'videos')
    expect(invalidate).toHaveBeenCalled()

    vi.stubEnv('NODE_ENV', 'test')
    table.mockClear()
    invalidate.mockClear()
    devUtils.logQueries(client)
    devUtils.clearPattern(client, 'videos')
    expect(table).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()

    vi.unstubAllEnvs()
    table.mockRestore()
  })
})
