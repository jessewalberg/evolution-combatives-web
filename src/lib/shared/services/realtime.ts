/**
 * Evolution Combatives - Shared Realtime Service
 * Common real-time subscription operations for both React Native and Next.js platforms
 * 
 * @description Centralized realtime service using Supabase client
 * @author Evolution Combatives
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
    TypedSupabaseClient,
    RealtimeCallback,
    DatabaseRecord,
    UserPresenceState,
    BroadcastPayload,
} from '../types/services'
import { handleSupabaseError } from '../utils/supabase-errors'

/**
 * Realtime service class that provides common real-time operations
 * Works with any Supabase client (browser, server, admin, mobile)
 */
export class RealtimeService {
    private subscriptions: Map<string, RealtimeChannel> = new Map()

    constructor(private supabase: TypedSupabaseClient) { }

    // ==========================================
    // TABLE SUBSCRIPTIONS
    // ==========================================

    /**
     * Subscribe to changes on a specific table
     */
    subscribeToTable(
        table: string,
        callback: RealtimeCallback,
        filter?: string,
        event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*'
    ): string {
        try {
            const subscriptionId = `table:${table}:${event}:${filter || 'all'}:${Date.now()}`

            interface PostgresChangesPayload {
                new?: Record<string, unknown>
                old?: Record<string, unknown>
                eventType: 'INSERT' | 'UPDATE' | 'DELETE'
            }

            // Create a properly typed channel subscription
            const channel = this.supabase.channel(subscriptionId)

            // Type assertion for postgres_changes event
            const typedChannel = channel as typeof channel & {
                on(
                    event: 'postgres_changes',
                    config: {
                        event: string
                        schema: string
                        table: string
                        filter?: string
                    },
                    callback: (payload: PostgresChangesPayload) => void
                ): typeof channel
            }

            const subscribedChannel = typedChannel
                .on(
                    'postgres_changes',
                    {
                        event,
                        schema: 'public',
                        table,
                        filter,
                    },
                    (payload: PostgresChangesPayload) => {
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`Realtime event on ${table}:`, payload)
                        }

                        callback({
                            new: payload.new,
                            old: payload.old,
                            eventType: payload.eventType,
                        })
                    }
                )
                .subscribe((status) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`Subscription ${subscriptionId} status:`, status)
                    }
                })

            this.subscriptions.set(subscriptionId, subscribedChannel)
            return subscriptionId
        } catch (error) {
            const processedError = handleSupabaseError(error, `subscribeToTable:${table}`)
            throw processedError
        }
    }

    /**
     * Subscribe to user-specific data changes
     */
    subscribeToUserData(
        userId: string,
        callback: RealtimeCallback,
        tables: string[] = ['profiles', 'user_progress', 'subscriptions']
    ): string[] {
        const subscriptionIds: string[] = []

        tables.forEach(table => {
            try {
                const subscriptionId = this.subscribeToTable(
                    table,
                    callback,
                    `user_id=eq.${userId}`
                )
                subscriptionIds.push(subscriptionId)
            } catch (error) {
                console.error(`Failed to subscribe to ${table} for user ${userId}:`, error)
            }
        })

        return subscriptionIds
    }

    /**
     * Subscribe to video progress updates for a specific user
     */
    subscribeToVideoProgress(
        userId: string,
        callback: RealtimeCallback,
        videoId?: string
    ): string {
        const filter = videoId
            ? `user_id=eq.${userId}&video_id=eq.${videoId}`
            : `user_id=eq.${userId}`

        return this.subscribeToTable('user_progress', callback, filter)
    }

    /**
     * Subscribe to video processing status changes
     */
    subscribeToVideoProcessing(callback: RealtimeCallback): string {
        return this.subscribeToTable(
            'videos',
            callback,
            'status=in.(processing,published,failed)'
        )
    }

    /**
     * Subscribe to new content releases
     */
    subscribeToNewContent(callback: RealtimeCallback): string {
        return this.subscribeToTable(
            'videos',
            callback,
            'status=eq.published',
            'INSERT'
        )
    }

    /**
     * Subscribe to subscription changes for a user
     */
    subscribeToSubscriptionChanges(
        userId: string,
        callback: RealtimeCallback
    ): string {
        return this.subscribeToTable(
            'subscriptions',
            callback,
            `user_id=eq.${userId}`
        )
    }

    /**
     * Subscribe to Q&A updates (admin)
     */
    subscribeToQAUpdates(callback: RealtimeCallback): string {
        return this.subscribeToTable('questions', callback)
    }

    /**
     * Subscribe to user activity (admin)
     */
    subscribeToUserActivity(callback: RealtimeCallback): string[] {
        const tables = ['profiles', 'user_progress', 'subscriptions']
        return tables.map(table =>
            this.subscribeToTable(table, callback)
        )
    }

    // ==========================================
    // PRESENCE TRACKING
    // ==========================================

    /**
     * Track user presence in a specific channel
     */
    trackPresence(
        channelName: string,
        userState: Record<string, unknown>,
        onPresenceChange?: (presences: Record<string, unknown>) => void
    ): string {
        try {
            const subscriptionId = `presence:${channelName}:${Date.now()}`

            const channel = this.supabase
                .channel(channelName)
                .on('presence', { event: 'sync' }, () => {
                    const presences = channel.presenceState()
                    if (onPresenceChange) {
                        onPresenceChange(presences)
                    }
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('User joined:', key, newPresences)
                    }
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('User left:', key, leftPresences)
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track(userState)
                    }
                })

            this.subscriptions.set(subscriptionId, channel)
            return subscriptionId
        } catch (error) {
            const processedError = handleSupabaseError(error, `trackPresence:${channelName}`)
            throw processedError
        }
    }

    /**
     * Update user presence state
     */
    async updatePresence(
        subscriptionId: string,
        newState: Record<string, unknown>
    ): Promise<void> {
        try {
            const channel = this.subscriptions.get(subscriptionId)
            if (channel) {
                await channel.track(newState)
            }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updatePresence')
            throw processedError
        }
    }

    /**
     * Stop tracking presence
     */
    async stopPresenceTracking(subscriptionId: string): Promise<void> {
        try {
            const channel = this.subscriptions.get(subscriptionId)
            if (channel) {
                await channel.untrack()
                await channel.unsubscribe()
                this.subscriptions.delete(subscriptionId)
            }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'stopPresenceTracking')
            throw processedError
        }
    }

    // ==========================================
    // BROADCAST MESSAGING
    // ==========================================

    /**
     * Send broadcast message to a channel
     */
    async sendBroadcast(
        channelName: string,
        event: string,
        payload: BroadcastPayload
    ): Promise<void> {
        try {
            const channel = this.supabase.channel(channelName)
            await channel.send({
                type: 'broadcast',
                event,
                payload,
            })
        } catch (error) {
            const processedError = handleSupabaseError(error, `sendBroadcast:${channelName}`)
            throw processedError
        }
    }

    /**
     * Listen to broadcast messages on a channel
     */
    subscribeToBroadcast(
        channelName: string,
        event: string,
        callback: (payload: BroadcastPayload) => void
    ): string {
        try {
            const subscriptionId = `broadcast:${channelName}:${event}:${Date.now()}`

            const channel = this.supabase
                .channel(channelName)
                .on('broadcast', { event }, callback)
                .subscribe()

            this.subscriptions.set(subscriptionId, channel)
            return subscriptionId
        } catch (error) {
            const processedError = handleSupabaseError(error, `subscribeToBroadcast:${channelName}`)
            throw processedError
        }
    }

    // ==========================================
    // SUBSCRIPTION MANAGEMENT
    // ==========================================

    /**
     * Unsubscribe from a specific subscription
     */
    async unsubscribe(subscriptionId: string): Promise<void> {
        try {
            const channel = this.subscriptions.get(subscriptionId)
            if (channel) {
                await channel.unsubscribe()
                this.subscriptions.delete(subscriptionId)

                if (process.env.NODE_ENV === 'development') {
                    console.log(`Unsubscribed from: ${subscriptionId}`)
                }
            }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'unsubscribe')
            console.error('Failed to unsubscribe:', processedError)
        }
    }

    /**
     * Unsubscribe from multiple subscriptions
     */
    async unsubscribeMultiple(subscriptionIds: string[]): Promise<void> {
        await Promise.allSettled(
            subscriptionIds.map(id => this.unsubscribe(id))
        )
    }

    /**
     * Unsubscribe from all active subscriptions
     */
    async unsubscribeAll(): Promise<void> {
        const subscriptionIds = Array.from(this.subscriptions.keys())
        await this.unsubscribeMultiple(subscriptionIds)
    }

    /**
     * Get list of active subscription IDs
     */
    getActiveSubscriptions(): string[] {
        return Array.from(this.subscriptions.keys())
    }

    /**
     * Get subscription count
     */
    getSubscriptionCount(): number {
        return this.subscriptions.size
    }

    /**
     * Check if a subscription is active
     */
    isSubscriptionActive(subscriptionId: string): boolean {
        return this.subscriptions.has(subscriptionId)
    }

    // ==========================================
    // CONNECTION MANAGEMENT
    // ==========================================

    /**
     * Get realtime connection status
     */
    getConnectionStatus(): string {
        // Note: This might vary based on Supabase version
        return (this.supabase as { realtime?: { connectionState(): string } }).realtime?.connectionState() || 'unknown'
    }

    /**
     * Manually reconnect realtime connection
     */
    async reconnect(): Promise<void> {
        try {
            // Note: This might vary based on Supabase version
            if ((this.supabase as any).realtime?.reconnect) {
                await (this.supabase as any).realtime.reconnect()
            }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'reconnect')
            throw processedError
        }
    }

    /**
     * Cleanup all subscriptions (call on app unmount/logout)
     */
    async cleanup(): Promise<void> {
        try {
            await this.unsubscribeAll()

            if (process.env.NODE_ENV === 'development') {
                console.log('Realtime service cleaned up')
            }
        } catch (error) {
            console.error('Error during realtime cleanup:', error)
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Create a debounced callback to prevent excessive updates
     */
    createDebouncedCallback(
        callback: RealtimeCallback,
        delay: number = 500
    ): RealtimeCallback {
        let timeoutId: NodeJS.Timeout | null = null

        return (payload) => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }

            timeoutId = setTimeout(() => {
                callback(payload)
                timeoutId = null
            }, delay)
        }
    }

    /**
     * Create a throttled callback to limit update frequency
     */
    createThrottledCallback(
        callback: RealtimeCallback,
        interval: number = 1000
    ): RealtimeCallback {
        let lastCall = 0

        return (payload) => {
            const now = Date.now()
            if (now - lastCall >= interval) {
                callback(payload)
                lastCall = now
            }
        }
    }
} 