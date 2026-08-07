import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RealtimeService } from './realtime'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

describe('RealtimeService', () => {
  const client = createFakeSupabaseClient()
  let service: RealtimeService

  beforeEach(() => {
    client.reset()
    service = new RealtimeService(client as never)
  })

  afterEach(async () => {
    await service.cleanup()
    vi.useRealTimers()
  })

  describe('subscribeToTable', () => {
    it('creates a postgres_changes subscription and stores it', () => {
      const callback = vi.fn()
      const subscriptionId = service.subscribeToTable('videos', callback, 'status=eq.published', 'INSERT')

      expect(subscriptionId).toMatch(/^table:videos:INSERT:/)
      expect(client.channel).toHaveBeenCalledWith(subscriptionId)
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: 'status=eq.published',
        }),
        expect.any(Function)
      )
      expect(client.lastChannel?.subscribe).toHaveBeenCalled()
      expect(service.isSubscriptionActive(subscriptionId)).toBe(true)
      expect(service.getSubscriptionCount()).toBe(1)
    })

    it('invokes callback with normalized payload', () => {
      const callback = vi.fn()
      service.subscribeToTable('videos', callback)

      const postgresHandler = client.lastChannel?.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      )?.[2] as (payload: {
        new: Record<string, unknown>
        old: Record<string, unknown>
        eventType: 'INSERT'
      }) => void

      postgresHandler({
        new: { id: 'v1' },
        old: {},
        eventType: 'INSERT',
      })

      expect(callback).toHaveBeenCalledWith({
        new: { id: 'v1' },
        old: {},
        eventType: 'INSERT',
      })
    })
  })

  describe('subscribeToUserData', () => {
    it('subscribes to default user tables with user filter', () => {
      const callback = vi.fn()
      const ids = service.subscribeToUserData('user-42', callback)

      expect(ids).toHaveLength(3)
      expect(service.getSubscriptionCount()).toBe(3)
      expect(client.channel).toHaveBeenCalledTimes(3)
    })
  })

  describe('unsubscribe', () => {
    it('unsubscribes and removes a single subscription', async () => {
      const id = service.subscribeToTable('videos', vi.fn())
      expect(service.getActiveSubscriptions()).toContain(id)

      await service.unsubscribe(id)

      expect(client.lastChannel?.unsubscribe).toHaveBeenCalled()
      expect(service.isSubscriptionActive(id)).toBe(false)
      expect(service.getSubscriptionCount()).toBe(0)
    })
  })

  describe('unsubscribeAll', () => {
    it('removes all active subscriptions', async () => {
      service.subscribeToTable('videos', vi.fn())
      service.subscribeToTable('profiles', vi.fn())

      expect(service.getSubscriptionCount()).toBe(2)

      await service.unsubscribeAll()

      expect(service.getSubscriptionCount()).toBe(0)
      expect(service.getActiveSubscriptions()).toEqual([])
    })
  })

  describe('subscription introspection', () => {
    it('reports active subscription ids and counts', () => {
      const id1 = service.subscribeToTable('videos', vi.fn())
      const id2 = service.subscribeToTable('profiles', vi.fn())

      expect(service.getActiveSubscriptions()).toEqual(expect.arrayContaining([id1, id2]))
      expect(service.getSubscriptionCount()).toBe(2)
      expect(service.isSubscriptionActive(id1)).toBe(true)
      expect(service.isSubscriptionActive('missing-id')).toBe(false)
    })
  })

  describe('trackPresence', () => {
    it('subscribes to presence channel and tracks user state on SUBSCRIBED', async () => {
      const onPresenceChange = vi.fn()
      const subscriptionId = service.trackPresence('room-1', { userId: 'u1' }, onPresenceChange)

      expect(subscriptionId).toMatch(/^presence:room-1:/)
      expect(client.channel).toHaveBeenCalledWith('room-1')
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'presence',
        { event: 'sync' },
        expect.any(Function)
      )

      await vi.waitFor(() => {
        expect(client.lastChannel?.track).toHaveBeenCalledWith({ userId: 'u1' })
      })
    })
  })

  describe('sendBroadcast', () => {
    it('sends broadcast message on channel', async () => {
      const payload = { event: 'new_message', type: 'broadcast', message: 'hello', from: 'admin' }

      await service.sendBroadcast('announcements', 'new_message', payload)

      expect(client.channel).toHaveBeenCalledWith('announcements')
      expect(client.lastChannel?.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'new_message',
        payload,
      })
    })
  })

  describe('subscribeToBroadcast', () => {
    it('registers broadcast listener and stores subscription', () => {
      const callback = vi.fn()
      const id = service.subscribeToBroadcast('announcements', 'new_message', callback)

      expect(id).toMatch(/^broadcast:announcements:new_message:/)
      expect(client.lastChannel?.on).toHaveBeenCalledWith('broadcast', { event: 'new_message' }, callback)
      expect(service.isSubscriptionActive(id)).toBe(true)
    })
  })

  describe('createDebouncedCallback', () => {
    it('debounces rapid invocations', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      const debounced = service.createDebouncedCallback(callback, 200)

      debounced({ eventType: 'UPDATE' })
      debounced({ eventType: 'UPDATE' })
      debounced({ eventType: 'UPDATE' })

      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(200)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ eventType: 'UPDATE' })
    })
  })

  describe('createThrottledCallback', () => {
    it('limits callback frequency to the configured interval', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      const throttled = service.createThrottledCallback(callback, 1000)

      throttled({ eventType: 'INSERT' })
      throttled({ eventType: 'UPDATE' })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ eventType: 'INSERT' })

      vi.advanceTimersByTime(1000)

      throttled({ eventType: 'DELETE' })
      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith({ eventType: 'DELETE' })
    })
  })

  describe('cleanup', () => {
    it('unsubscribes all channels on cleanup', async () => {
      service.subscribeToTable('videos', vi.fn())
      service.subscribeToBroadcast('room', 'ping', vi.fn())

      await service.cleanup()

      expect(service.getSubscriptionCount()).toBe(0)
    })
  })

  describe('getConnectionStatus', () => {
    it('returns realtime connection state from client', () => {
      expect(service.getConnectionStatus()).toBe('connected')
    })

    it('returns unknown when realtime is not available', () => {
      const bareClient = createFakeSupabaseClient()
      delete (bareClient as { realtime?: unknown }).realtime
      const bareService = new RealtimeService(bareClient as never)

      expect(bareService.getConnectionStatus()).toBe('unknown')
    })
  })

  describe('subscribeToUserData error handling', () => {
    it('logs and skips a table when subscribeToTable throws, continues with the rest', () => {
      const callback = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      client.channel.mockImplementationOnce(() => {
        throw new Error('channel boom')
      })

      const ids = service.subscribeToUserData('user-1', callback, ['profiles', 'user_progress'])

      expect(ids).toHaveLength(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to subscribe to profiles for user user-1'),
        expect.any(Error)
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('domain-specific subscription helpers', () => {
    it('subscribeToVideoProgress filters by user and video when videoId provided', () => {
      const callback = vi.fn()
      service.subscribeToVideoProgress('user-1', callback, 'vid-1')

      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'user_progress',
          filter: 'user_id=eq.user-1&video_id=eq.vid-1',
        }),
        expect.any(Function)
      )
    })

    it('subscribeToVideoProgress filters by user only when videoId omitted', () => {
      const callback = vi.fn()
      service.subscribeToVideoProgress('user-1', callback)

      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'user_progress',
          filter: 'user_id=eq.user-1',
        }),
        expect.any(Function)
      )
    })

    it('subscribeToVideoProcessing subscribes to videos table with status filter', () => {
      service.subscribeToVideoProcessing(vi.fn())
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'videos',
          filter: 'status=in.(processing,published,failed)',
        }),
        expect.any(Function)
      )
    })

    it('subscribeToNewContent subscribes to INSERT events on published videos', () => {
      const id = service.subscribeToNewContent(vi.fn())
      expect(id).toMatch(/^table:videos:INSERT:/)
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'videos', event: 'INSERT', filter: 'status=eq.published' }),
        expect.any(Function)
      )
    })

    it('subscribeToSubscriptionChanges filters by user id', () => {
      service.subscribeToSubscriptionChanges('user-9', vi.fn())
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'subscriptions', filter: 'user_id=eq.user-9' }),
        expect.any(Function)
      )
    })

    it('subscribeToQAUpdates subscribes to the questions table with no filter', () => {
      service.subscribeToQAUpdates(vi.fn())
      expect(client.lastChannel?.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'questions', filter: undefined }),
        expect.any(Function)
      )
    })

    it('subscribeToUserActivity subscribes to all admin activity tables', () => {
      const ids = service.subscribeToUserActivity(vi.fn())
      expect(ids).toHaveLength(3)
      expect(client.channel).toHaveBeenCalledTimes(3)
    })
  })

  describe('trackPresence lifecycle', () => {
    it('invokes onPresenceChange on sync and tracks state once subscribed', async () => {
      const onPresenceChange = vi.fn()
      service.trackPresence('room-1', { userId: 'u1' }, onPresenceChange)

      const syncHandler = client.lastChannel?.on.mock.calls.find((call) => call[1]?.event === 'sync')?.[2] as () => void
      const joinHandler = client.lastChannel?.on.mock.calls.find((call) => call[1]?.event === 'join')?.[2] as (arg: { key: string; newPresences: unknown[] }) => void
      const leaveHandler = client.lastChannel?.on.mock.calls.find((call) => call[1]?.event === 'leave')?.[2] as (arg: { key: string; leftPresences: unknown[] }) => void

      expect(syncHandler).toBeInstanceOf(Function)
      syncHandler()
      expect(onPresenceChange).toHaveBeenCalledWith({})

      expect(() => joinHandler({ key: 'u2', newPresences: [] })).not.toThrow()
      expect(() => leaveHandler({ key: 'u2', leftPresences: [] })).not.toThrow()

      await vi.waitFor(() => {
        expect(client.lastChannel?.track).toHaveBeenCalledWith({ userId: 'u1' })
      })
    })

    it('throws a processed error when channel creation fails', () => {
      client.channel.mockImplementationOnce(() => {
        throw new Error('presence boom')
      })

      expect(() => service.trackPresence('room-err', {})).toThrow()
    })
  })

  describe('updatePresence', () => {
    it('tracks new state on an existing subscription', async () => {
      const id = service.trackPresence('room-2', { userId: 'u1' })
      await service.updatePresence(id, { status: 'away' })

      expect(client.lastChannel?.track).toHaveBeenCalledWith({ status: 'away' })
    })

    it('is a no-op when the subscription does not exist', async () => {
      await expect(service.updatePresence('missing-id', { status: 'away' })).resolves.toBeUndefined()
    })
  })

  describe('stopPresenceTracking', () => {
    it('untracks, unsubscribes, and removes an existing subscription', async () => {
      const id = service.trackPresence('room-3', { userId: 'u1' })
      await service.stopPresenceTracking(id)

      expect(client.lastChannel?.untrack).toHaveBeenCalled()
      expect(client.lastChannel?.unsubscribe).toHaveBeenCalled()
      expect(service.isSubscriptionActive(id)).toBe(false)
    })

    it('is a no-op when the subscription does not exist', async () => {
      await expect(service.stopPresenceTracking('missing-id')).resolves.toBeUndefined()
    })
  })

  describe('unsubscribeMultiple', () => {
    it('unsubscribes from all given ids even if some fail', async () => {
      const id1 = service.subscribeToTable('videos', vi.fn())
      const id2 = service.subscribeToTable('profiles', vi.fn())

      await service.unsubscribeMultiple([id1, id2, 'missing-id'])

      expect(service.getSubscriptionCount()).toBe(0)
    })
  })

  describe('unsubscribe error handling', () => {
    it('logs and swallows errors instead of throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const id = service.subscribeToTable('videos', vi.fn())
      client.lastChannel!.unsubscribe.mockRejectedValueOnce(new Error('unsub boom'))

      await expect(service.unsubscribe(id)).resolves.toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to unsubscribe:', expect.anything())
      consoleErrorSpy.mockRestore()
    })
  })

  describe('sendBroadcast error handling', () => {
    it('throws a processed error when send fails', async () => {
      client.channel.mockImplementationOnce(() => {
        const channel = {
          on: vi.fn(function (this: unknown) { return this }),
          subscribe: vi.fn(function (this: unknown) { return this }),
          unsubscribe: vi.fn(async () => 'ok'),
          track: vi.fn(async () => 'ok'),
          untrack: vi.fn(async () => 'ok'),
          send: vi.fn(async () => { throw new Error('send boom') }),
          presenceState: vi.fn(() => ({})),
        }
        return channel
      })

      await expect(service.sendBroadcast('room', 'evt', { event: 'evt', type: 'broadcast' })).rejects.toThrow()
    })
  })

  describe('subscribeToBroadcast error handling', () => {
    it('throws a processed error when channel creation fails', () => {
      client.channel.mockImplementationOnce(() => {
        throw new Error('broadcast boom')
      })

      expect(() => service.subscribeToBroadcast('room', 'evt', vi.fn())).toThrow()
    })
  })

  describe('reconnect', () => {
    it('calls the underlying realtime reconnect when available', async () => {
      const reconnectSpy = vi.spyOn(client.realtime!, 'reconnect')
      await expect(service.reconnect()).resolves.toBeUndefined()
      expect(reconnectSpy).toHaveBeenCalled()
    })

    it('is a no-op when no reconnect method is available', async () => {
      const bareClient = createFakeSupabaseClient()
      delete (bareClient as { realtime?: unknown }).realtime
      const bareService = new RealtimeService(bareClient as never)

      await expect(bareService.reconnect()).resolves.toBeUndefined()
    })

    it('throws a processed error when reconnect rejects', async () => {
      const failingClient = createFakeSupabaseClient()
      ;(failingClient as { realtime?: { connectionState: () => string; reconnect: () => Promise<void> } }).realtime = {
        connectionState: () => 'connected',
        reconnect: async () => { throw new Error('reconnect boom') },
      }
      const failingService = new RealtimeService(failingClient as never)

      await expect(failingService.reconnect()).rejects.toThrow()
    })
  })

  describe('cleanup error handling', () => {
    it('logs instead of throwing when cleanup fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      service.subscribeToTable('videos', vi.fn())
      client.lastChannel!.unsubscribe.mockRejectedValueOnce(new Error('cleanup boom'))

      await expect(service.cleanup()).resolves.toBeUndefined()
      consoleErrorSpy.mockRestore()
    })
  })

})
