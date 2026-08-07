import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseService } from './database'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

describe('DatabaseService', () => {
  const client = createFakeSupabaseClient()
  const service = new DatabaseService(client as never)

  beforeEach(() => {
    client.reset()
  })

  describe('getVideos', () => {
    it('returns transformed videos and applies default published filter', async () => {
      client.setTableResult('videos', {
        data: [
          {
            id: 'video-1',
            title: 'Takedown Basics',
            status: 'published',
            tags: [{ tag: { id: 't1', name: 'grappling' } }, { tag: null }],
          },
        ],
        error: null,
      })

      const result = await service.getVideos()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].tags).toEqual([{ id: 't1', name: 'grappling' }])

      const videoCall = client.calls.find((c) => c.table === 'videos')
      expect(videoCall?.filters.some((f) => f.type === 'eq' && f.args[0] === 'status')).toBe(true)
    })

    it('applies optional filters and pagination', async () => {
      client.setTableResult('videos', { data: [], error: null })

      await service.getVideos({
        categoryId: 'cat-1',
        difficulty: 'tier1',
        subscriptionTier: 'tier2',
        instructorId: 'inst-1',
        status: 'draft',
        search: 'guard',
        sortBy: 'title',
        sortOrder: 'asc',
        limit: 5,
        offset: 10,
      })

      const videoCall = client.calls.find((c) => c.table === 'videos')
      const filterTypes = videoCall?.filters.map((f) => f.type) ?? []

      expect(filterTypes).toContain('eq')
      expect(filterTypes).toContain('lte')
      expect(filterTypes).toContain('or')
      expect(filterTypes).toContain('order')
      expect(filterTypes).toContain('limit')
      expect(filterTypes).toContain('range')
    })

    it('returns error message on query failure', async () => {
      client.setTableResult('videos', {
        data: null,
        error: { code: 'PGRST116', message: 'not found', details: '', hint: '' },
      })

      const result = await service.getVideos()

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/No data found/i)
    })
  })

  describe('getVideo', () => {
    it('returns a single published video with flattened tags', async () => {
      client.setTableResult('videos', {
        data: {
          id: 'video-2',
          title: 'Single Video',
          tags: [{ tag: { id: 't2', name: 'striking' } }],
        },
        error: null,
      })

      const result = await service.getVideo('video-2')

      expect(result.error).toBeNull()
      expect(result.data?.id).toBe('video-2')
      expect(result.data?.tags).toEqual([{ id: 't2', name: 'striking' }])
    })
  })

  describe('getUserProfile', () => {
    it('returns profile with first subscription flattened', async () => {
      client.setTableResult('profiles', {
        data: {
          id: 'user-1',
          full_name: 'Officer Smith',
          subscription: [
            {
              id: 'sub-1',
              tier: 'tier2',
              status: 'active',
              current_period_start: '2024-01-01',
              current_period_end: '2024-02-01',
              cancel_at_period_end: false,
              created_at: '2024-01-01',
            },
          ],
        },
        error: null,
      })

      const result = await service.getUserProfile('user-1')

      expect(result.error).toBeNull()
      expect(result.data?.subscription?.tier).toBe('tier2')
      expect(Array.isArray(result.data?.subscription)).toBe(false)
    })
  })

  describe('updateProfile', () => {
    it('updates profile and returns updated row', async () => {
      client.queueResult({
        data: { id: 'user-1', full_name: 'Updated Name', updated_at: '2024-06-01' },
        error: null,
      })

      const result = await service.updateProfile('user-1', { full_name: 'Updated Name' })

      expect(result.error).toBeNull()
      expect(result.data?.full_name).toBe('Updated Name')

      const updateCall = client.calls.find((c) => c.table === 'profiles' && c.method === 'update')
      expect(updateCall?.payload).toMatchObject({ full_name: 'Updated Name' })
    })
  })

  describe('getCategories', () => {
    it('returns categories with video_count derived from nested count', async () => {
      client.setTableResult('categories', {
        data: [
          {
            id: 'cat-1',
            name: 'Handcuffing',
            videos: [{ count: 7 }],
          },
        ],
        error: null,
      })

      const result = await service.getCategories()

      expect(result.error).toBeNull()
      expect(result.data?.[0].video_count).toBe(7)
    })

    it('filters by discipline when disciplineId is provided', async () => {
      client.setTableResult('categories', { data: [], error: null })

      await service.getCategories('discipline-1')

      const call = client.calls.find((c) => c.table === 'categories')
      expect(call?.filters.some((f) => f.type === 'eq' && f.args[0] === 'discipline_id')).toBe(true)
    })
  })

  describe('getDisciplines', () => {
    it('returns disciplines ordered by sort_order', async () => {
      client.setTableResult('disciplines', {
        data: [
          { id: 'd1', name: 'Law Enforcement', sort_order: 1, created_at: '2024-01-01' },
        ],
        error: null,
      })

      const result = await service.getDisciplines()

      expect(result.error).toBeNull()
      expect(result.data?.[0].name).toBe('Law Enforcement')
    })
  })

  describe('getUserSubscription', () => {
    it('returns active subscription for user', async () => {
      client.setTableResult('subscriptions', {
        data: {
          id: 'sub-1',
          user_id: 'user-1',
          tier: 'tier2',
          status: 'active',
          current_period_start: '2024-01-01',
          current_period_end: '2024-02-01',
          cancel_at_period_end: false,
          created_at: '2024-01-01',
        },
        error: null,
      })

      const result = await service.getUserSubscription('user-1')

      expect(result.error).toBeNull()
      expect(result.data?.tier).toBe('tier2')
    })
  })

  describe('updateSubscription', () => {
    it('upserts subscription data for user', async () => {
      client.queueResult({
        data: {
          id: 'sub-1',
          user_id: 'user-1',
          tier: 'tier3',
          status: 'active',
          current_period_start: '2024-01-01',
          current_period_end: '2024-02-01',
          cancel_at_period_end: false,
          created_at: '2024-01-01',
          updated_at: '2024-06-01',
        },
        error: null,
      })

      const result = await service.updateSubscription('user-1', { tier: 'tier3', status: 'active' })

      expect(result.error).toBeNull()
      expect(result.data?.tier).toBe('tier3')

      const upsertCall = client.calls.find((c) => c.table === 'subscriptions' && c.method === 'upsert')
      expect(upsertCall?.payload).toMatchObject({ user_id: 'user-1', tier: 'tier3' })
    })
  })

  describe('getUserProgress', () => {
    it('returns progress rows for user ordered by last watched', async () => {
      client.setTableResult('user_progress', {
        data: [
          {
            user_id: 'user-1',
            video_id: 'video-1',
            progress_percent: 50,
            video: { id: 'video-1', title: 'Drill 1' },
          },
        ],
        error: null,
      })

      const result = await service.getUserProgress('user-1')

      expect(result.error).toBeNull()
      expect(result.data?.[0].video_id).toBe('video-1')
    })

    it('filters by videoId when provided', async () => {
      client.setTableResult('user_progress', { data: [], error: null })

      await service.getUserProgress('user-1', 'video-9')

      const call = client.calls.find((c) => c.table === 'user_progress')
      expect(call?.filters.some((f) => f.type === 'eq' && f.args[0] === 'video_id')).toBe(true)
    })
  })

  describe('updateProgress', () => {
    it('upserts progress with timestamps', async () => {
      client.queueResult({
        data: {
          user_id: 'user-1',
          video_id: 'video-1',
          progress_percentage: 100,
          video: { id: 'video-1', title: 'Complete' },
        },
        error: null,
      })

      const result = await service.updateProgress('user-1', 'video-1', {
        progress_seconds: 120,
        progress_percentage: 100,
        completed: true,
      })

      expect(result.error).toBeNull()
      expect(result.data?.progress_percentage).toBe(100)

      const upsertCall = client.calls.find((c) => c.table === 'user_progress' && c.method === 'upsert')
      expect(upsertCall?.payload).toMatchObject({
        user_id: 'user-1',
        video_id: 'video-1',
        progress_percentage: 100,
        completed: true,
      })
    })
  })

  describe('markNotificationRead', () => {
    it('marks notification as read', async () => {
      client.queueResult({
        data: { id: 'notif-1', read: true, user_id: 'user-1', message: 'Hello' },
        error: null,
      })

      const result = await service.markNotificationRead('notif-1')

      expect(result.error).toBeNull()
      expect(result.data?.read).toBe(true)

      const updateCall = client.calls.find((c) => c.table === 'notifications' && c.method === 'update')
      expect(updateCall?.payload).toEqual({ read: true })
    })
  })

  describe('getUserNotifications', () => {
    it('returns notifications for user', async () => {
      client.setTableResult('notifications', {
        data: [{ id: 'notif-1', user_id: 'user-1', message: 'New content', read: false }],
        error: null,
      })

      const result = await service.getUserNotifications('user-1')

      expect(result.error).toBeNull()
      expect(result.data?.[0].id).toBe('notif-1')
    })
  })

  describe('search', () => {
    it('calls search_content rpc with query and limit', async () => {
      client.queueResult({
        data: [{ type: 'video', id: 'video-1', title: 'Guard Pass' }],
        error: null,
      })

      const result = await service.search('guard', 10)

      expect(result.error).toBeNull()
      expect(result.data?.[0].title).toBe('Guard Pass')

      const rpcCall = client.calls.find((c) => c.table === 'rpc:search_content')
      expect(rpcCall?.payload).toEqual({ search_query: 'guard', result_limit: 10 })
    })
  })

  describe('getVideoAnalytics', () => {
    it('returns analytics from rpc', async () => {
      client.queueResult({
        data: { total_views: 1000, total_videos: 42 },
        error: null,
      })

      const result = await service.getVideoAnalytics()

      expect(result.error).toBeNull()
      expect(result.data?.total_views).toBe(1000)
      expect(client.calls.some((c) => c.table === 'rpc:get_video_analytics')).toBe(true)
    })
  })

  describe('getUserAnalytics', () => {
    it('returns user analytics from rpc', async () => {
      client.queueResult({
        data: { total_users: 500, active_users: 120 },
        error: null,
      })

      const result = await service.getUserAnalytics()

      expect(result.error).toBeNull()
      expect(result.data?.active_users).toBe(120)
      expect(client.calls.some((c) => c.table === 'rpc:get_user_analytics')).toBe(true)
    })
  })

  describe('getInstructors', () => {
    it('returns instructors with derived stats', async () => {
      client.setTableResult('profiles', {
        data: [
          {
            id: 'inst-1',
            instructor_bio: 'Coach',
            videos: [{ count: 3 }],
            video_views: [{ views: 10 }, { views: 5 }],
          },
        ],
        error: null,
      })

      const result = await service.getInstructors()

      expect(result.error).toBeNull()
      expect(result.data?.[0].video_count).toBe(3)
      expect(result.data?.[0].total_views).toBe(15)
    })
  })

  describe('getAllUsers', () => {
    it('returns paginated users with flattened subscription', async () => {
      client.queueResult({ count: 2, data: null, error: null })
      client.queueResult({
        data: [
          {
            id: 'u1',
            full_name: 'A',
            subscription: [{ id: 's1', tier: 'tier1', status: 'active' }],
          },
        ],
        error: null,
      })

      const result = await service.getAllUsers({ page: 1, pageSize: 10 })

      expect(result.error).toBeNull()
      expect(result.data?.count).toBe(2)
      expect(result.data?.data[0].subscription).toMatchObject({ tier: 'tier1' })
      expect(result.data?.hasPreviousPage).toBe(false)
    })
  })

  describe('getTableStats / executeRawQuery', () => {
    it('returns table stats from rpc', async () => {
      client.queueResult({ data: { videos: 10, users: 5 }, error: null })
      const result = await service.getTableStats()
      expect(result.error).toBeNull()
      expect(result.data?.videos).toBe(10)
      expect(client.calls.some((c) => c.table === 'rpc:get_table_stats')).toBe(true)
    })

    it('executes raw sql via rpc', async () => {
      client.queueResult({ data: [{ id: 1 }], error: null })
      const result = await service.executeRawQuery('select 1', [])
      expect(result.error).toBeNull()
      expect(client.calls.some((c) => c.table === 'rpc:execute_sql')).toBe(true)
    })
  })
})
