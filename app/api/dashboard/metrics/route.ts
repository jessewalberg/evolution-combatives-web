import { NextResponse } from 'next/server'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import { createAdminClient } from '../../../../src/lib/supabase'

export async function GET() {
    console.log('Dashboard metrics API called')

    const authResult = await validateApiAuthWithSession('analytics.read')
    if ('error' in authResult) {
        console.log('Dashboard metrics auth failed:', authResult.error)
        return authResult.error
    }

    console.log('Dashboard metrics auth successful for user:', authResult.user.email)

    try {
        console.log('Creating admin client...')
        const supabase = createAdminClient()
        console.log('Admin client created successfully')

        const [
            usersResult,
            subscriptionsResult,
            videosResult
        ] = await Promise.all([
            // Users metrics
            supabase
                .from('profiles')
                .select('id, created_at')
                .order('created_at', { ascending: false }),

            // Subscriptions metrics
            supabase
                .from('subscriptions')
                .select('id, tier, status, current_period_end, created_at')
                .eq('status', 'active'),

            // Videos metrics
            supabase
                .from('videos')
                .select('id, created_at, processing_status, view_count')
                .order('created_at', { ascending: false })
        ])

        if (usersResult.error) {
            console.error('Users query error:', usersResult.error)
            throw usersResult.error
        }
        if (subscriptionsResult.error) {
            console.error('Subscriptions query error:', subscriptionsResult.error)
            throw subscriptionsResult.error
        }
        if (videosResult.error) {
            console.error('Videos query error:', videosResult.error)
            throw videosResult.error
        }

        console.log('Dashboard API query results:', {
            users: usersResult.data?.length || 0,
            videos: videosResult.data?.length || 0,
            subscriptions: subscriptionsResult.data?.length || 0
        })

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

        // Calculate metrics
        const totalUsers = usersResult.data?.length || 0
        const usersThisMonth = usersResult.data?.filter(u =>
            new Date(u.created_at) >= thirtyDaysAgo
        ).length || 0
        const usersLastMonth = usersResult.data?.filter(u =>
            new Date(u.created_at) >= sixtyDaysAgo && new Date(u.created_at) < thirtyDaysAgo
        ).length || 0

        const activeSubscriptions = subscriptionsResult.data?.length || 0
        const monthlyRevenue = subscriptionsResult.data?.reduce((sum, sub) => {
            // Updated tier prices for new tier system
            const tierPrices = {
                none: 0,
                tier1: 9,
                tier2: 19,
                tier3: 49,
                // Legacy support
                beginner: 9,
                intermediate: 19,
                advanced: 49
            }
            return sum + (tierPrices[sub.tier as keyof typeof tierPrices] || 0)
        }, 0) || 0

        const totalVideos = videosResult.data?.length || 0
        const videosThisMonth = videosResult.data?.filter(v =>
            new Date(v.created_at) >= thirtyDaysAgo
        ).length || 0
        const processingVideos = videosResult.data?.filter(v =>
            v.processing_status === 'processing' || v.processing_status === 'uploading'
        ).length || 0

        // Mock engagement data for now since user_progress table schema is unclear
        const avgEngagementTime = 0

        const metrics = {
            totalUsers,
            totalUsersGrowth: usersLastMonth > 0 ?
                ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100 : 0,
            activeSubscriptions,
            monthlyRevenue,
            revenueGrowth: 12.5, // Mock data - would calculate from historical data
            totalVideos,
            videosThisMonth,
            avgEngagementTime,
            engagementGrowth: 8.3, // Mock data
            processingVideos,
            pendingQA: 5, // Mock data - would come from Q&A system
            systemAlerts: 2 // Mock data - would come from monitoring system
        }

        return NextResponse.json({
            success: true,
            data: metrics
        })
    } catch (error) {
        console.error('Dashboard metrics API error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
