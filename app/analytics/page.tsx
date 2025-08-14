/**
 * Evolution Combatives - Analytics Dashboard
 * Comprehensive analytics and reporting for tactical training platform
 * 
 * @description Main analytics dashboard with revenue, user, content, and system metrics
 * @author Evolution Combatives
 */

'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../src/hooks/useAuth'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { StatsCard, StatsCardGrid, CompactStatsRow } from '../../src/components/ui/stats-card'
import { Card, CardHeader, CardTitle, CardContent } from '../../src/components/ui/card'
import { Button } from '../../src/components/ui/button'
import { Badge } from '../../src/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../src/components/ui/dropdown'
import { EmptyState } from '../../src/components/ui/empty-state'
import { Spinner } from '../../src/components/ui/loading'
import { cn } from '../../src/lib/utils'
import { toast } from 'sonner'

// Charts
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'

// Icons
import {
    ChartBarIcon,
    CurrencyDollarIcon,
    UsersIcon,
    VideoCameraIcon,
    GlobeAltIcon,
    EyeIcon,
    DocumentArrowDownIcon,
    CalendarIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    ServerIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface AnalyticsData {
    // Executive Summary
    totalRevenue: number
    revenueGrowth: number
    totalUsers: number
    userGrowth: number
    activeUsers: number
    engagementRate: number
    totalVideos: number
    avgWatchTime: number

    // Time series data
    revenueOverTime: Array<{
        date: string
        revenue: number
        subscriptions: number
    }>

    userGrowthOverTime: Array<{
        date: string
        newUsers: number
        totalUsers: number
        churn: number
    }>

    videoEngagement: Array<{
        title: string
        views: number
        avgWatchTime: number
        completionRate: number
    }>

    geographicData: Array<{
        region: string
        users: number
        revenue: number
    }>

    subscriptionBreakdown: Array<{
        tier: string
        count: number
        revenue: number
        color: string
    }>

    // Real-time metrics
    currentActiveUsers: number
    liveStreamingSessions: number
    recentSubscriptionChanges: Array<{
        type: 'upgrade' | 'downgrade' | 'new' | 'cancelled'
        count: number
        timestamp: string
    }>

    systemHealth: {
        cpuUsage: number
        memoryUsage: number
        diskUsage: number
        responseTime: number
        uptime: number
        errors: number
    }
}

interface TimeRange {
    label: string
    value: string
    days: number
}

const timeRanges: TimeRange[] = [
    { label: 'Last 7 days', value: '7d', days: 7 },
    { label: 'Last 30 days', value: '30d', days: 30 },
    { label: 'Last 90 days', value: '90d', days: 90 },
    { label: 'Last 6 months', value: '6m', days: 180 },
    { label: 'Last year', value: '1y', days: 365 }
]

export default function AnalyticsPage() {
    const router = useRouter()
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const supabase = createClientComponentClient()

    // State
    const [timeRange, setTimeRange] = useState<TimeRange>(timeRanges[1]) // Default to 30 days
    const [isExporting, setIsExporting] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)

    // Analytics data query
    const analyticsQuery = useQuery({
        queryKey: ['analytics', timeRange.value],
        queryFn: async (): Promise<AnalyticsData> => {
            const endDate = new Date()
            const startDate = new Date(endDate.getTime() - timeRange.days * 24 * 60 * 60 * 1000)

            // Fetch all data in parallel
            const [
                usersResult,
                subscriptionsResult,
                videosResult,
                progressResult
            ] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, created_at, last_sign_in_at')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: false }),

                supabase
                    .from('subscriptions')
                    .select('id, tier, status, created_at, current_period_end')
                    .gte('created_at', startDate.toISOString()),

                supabase
                    .from('videos')
                    .select('id, title, created_at, view_count, duration')
                    .order('view_count', { ascending: false }),

                supabase
                    .from('user_progress')
                    .select('id, video_id, progress_seconds, watch_time, completed, created_at')
                    .gte('created_at', startDate.toISOString())
            ])

            if (usersResult.error) throw usersResult.error
            if (subscriptionsResult.error) throw subscriptionsResult.error
            if (videosResult.error) throw videosResult.error
            if (progressResult.error) throw progressResult.error

            // Process data for analytics
            const users = usersResult.data || []
            const subscriptions = subscriptionsResult.data || []
            const videos = videosResult.data || []
            const progress = progressResult.data || []

            // Calculate metrics
            const tierPrices = { beginner: 9, intermediate: 19, advanced: 49 }
            const activeSubscriptions = subscriptions.filter(s => s.status === 'active')
            const totalRevenue = activeSubscriptions.reduce((sum, sub) =>
                sum + (tierPrices[sub.tier as keyof typeof tierPrices] || 0), 0
            )

            const activeUsers = users.filter(u =>
                u.last_sign_in_at &&
                new Date(u.last_sign_in_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length

            const totalWatchTime = progress.reduce((sum, p) => sum + (p.watch_time || 0), 0)
            const avgWatchTime = progress.length > 0 ? totalWatchTime / progress.length : 0

            // Generate time series data (mock data for demonstration)
            const revenueOverTime = Array.from({ length: timeRange.days }, (_, i) => {
                const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
                return {
                    date: date.toISOString().split('T')[0],
                    revenue: Math.floor(Math.random() * 5000) + 15000,
                    subscriptions: Math.floor(Math.random() * 50) + 200
                }
            })

            const userGrowthOverTime = Array.from({ length: timeRange.days }, (_, i) => {
                const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
                return {
                    date: date.toISOString().split('T')[0],
                    newUsers: Math.floor(Math.random() * 20) + 5,
                    totalUsers: 1500 + i * 10,
                    churn: Math.floor(Math.random() * 5)
                }
            })

            // Top videos by engagement
            const videoEngagement = videos.slice(0, 10).map(video => ({
                title: video.title.length > 30 ? video.title.substring(0, 30) + '...' : video.title,
                views: video.view_count || Math.floor(Math.random() * 1000),
                avgWatchTime: Math.floor(Math.random() * 300) + 60,
                completionRate: Math.floor(Math.random() * 40) + 60
            }))

            // Geographic data (mock)
            const geographicData = [
                { region: 'United States', users: 1247, revenue: 24940 },
                { region: 'Canada', users: 234, revenue: 4680 },
                { region: 'United Kingdom', users: 156, revenue: 3120 },
                { region: 'Australia', users: 89, revenue: 1780 },
                { region: 'Germany', users: 67, revenue: 1340 },
                { region: 'Other', users: 123, revenue: 2460 }
            ]

            // Subscription breakdown
            const subscriptionBreakdown = [
                { tier: 'Beginner', count: 45, revenue: 405, color: '#10B981' },
                { tier: 'Intermediate', count: 128, revenue: 2432, color: '#3B82F6' },
                { tier: 'Advanced', count: 67, revenue: 3283, color: '#8B5CF6' }
            ]

            // Real-time metrics (mock)
            const currentActiveUsers = Math.floor(Math.random() * 50) + 25
            const liveStreamingSessions = Math.floor(Math.random() * 10) + 5

            const recentSubscriptionChanges = [
                { type: 'new' as const, count: 12, timestamp: new Date().toISOString() },
                { type: 'upgrade' as const, count: 5, timestamp: new Date().toISOString() },
                { type: 'downgrade' as const, count: 2, timestamp: new Date().toISOString() },
                { type: 'cancelled' as const, count: 3, timestamp: new Date().toISOString() }
            ]

            const systemHealth = {
                cpuUsage: Math.floor(Math.random() * 30) + 20,
                memoryUsage: Math.floor(Math.random() * 40) + 30,
                diskUsage: Math.floor(Math.random() * 25) + 15,
                responseTime: Math.floor(Math.random() * 100) + 50,
                uptime: 99.9,
                errors: Math.floor(Math.random() * 5)
            }

            return {
                totalRevenue,
                revenueGrowth: 12.5, // Mock growth
                totalUsers: users.length,
                userGrowth: 8.3, // Mock growth
                activeUsers,
                engagementRate: 76.4, // Mock engagement
                totalVideos: videos.length,
                avgWatchTime,
                revenueOverTime,
                userGrowthOverTime,
                videoEngagement,
                geographicData,
                subscriptionBreakdown,
                currentActiveUsers,
                liveStreamingSessions,
                recentSubscriptionChanges,
                systemHealth
            }
        },
        staleTime: autoRefresh ? 30 * 1000 : 5 * 60 * 1000, // 30s if auto-refresh, 5min otherwise
        refetchInterval: autoRefresh ? 30 * 1000 : false,
        enabled: !!user && !!profile?.admin_role
    })

    // Export functionality
    const handleExport = useCallback(async (format: 'csv' | 'excel' | 'png') => {
        if (!analyticsQuery.data) return

        setIsExporting(true)
        try {
            // Mock export functionality
            await new Promise(resolve => setTimeout(resolve, 2000))

            if (format === 'png') {
                toast.success('Charts exported as images successfully')
            } else {
                toast.success(`Analytics data exported to ${format.toUpperCase()} successfully`)
            }
        } catch (error) {
            toast.error('Export failed. Please try again.')
        } finally {
            setIsExporting(false)
        }
    }, [analyticsQuery.data])

    // Schedule report
    const handleScheduleReport = useCallback(() => {
        toast.success('Report scheduling feature coming soon')
    }, [])

    // Custom chart colors matching Evolution Combatives theme
    const chartColors = {
        primary: '#3B82F6',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#8B5CF6',
        neutral: '#6B7280'
    }

    // Check permissions
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!user || !profile?.admin_role || !hasPermission('analytics.read')) {
        return (
            <EmptyState
                icon={ExclamationTriangleIcon}
                title="Access Denied"
                description="You don't have permission to view analytics data."
                primaryAction={{
                    label: "Go to Dashboard",
                    onClick: () => router.push('/dashboard'),
                    variant: "primary"
                }}
                iconVariant="warning"
            />
        )
    }

    // Loading state
    if (analyticsQuery.isLoading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-64 bg-neutral-700 rounded animate-pulse" />
                        <div className="h-4 w-96 bg-neutral-800 rounded mt-2 animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-32 bg-neutral-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    // Error state
    if (analyticsQuery.error) {
        return (
            <EmptyState
                icon={ExclamationTriangleIcon}
                title="Failed to load analytics"
                description="There was an error loading your analytics data. Please try again."
                primaryAction={{
                    label: "Retry",
                    onClick: () => analyticsQuery.refetch(),
                    variant: "primary"
                }}
                iconVariant="error"
            />
        )
    }

    const data = analyticsQuery.data!

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        Analytics Dashboard
                    </h1>
                    <p className="text-neutral-400 mt-2">
                        Comprehensive insights into your tactical training platform performance
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Time Range Selector */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                {timeRange.label}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {timeRanges.map(range => (
                                <DropdownMenuItem
                                    key={range.value}
                                    onClick={() => setTimeRange(range)}
                                >
                                    {range.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Auto Refresh Toggle */}
                    <Button
                        variant={autoRefresh ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className="gap-2"
                    >
                        <Cog6ToothIcon className="h-4 w-4" />
                        Auto Refresh
                    </Button>

                    {/* Export Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={isExporting} className="gap-2">
                                <DocumentArrowDownIcon className="h-4 w-4" />
                                {isExporting ? 'Exporting...' : 'Export'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleExport('png')}>
                                Export Charts as PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('csv')}>
                                Export Data as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('excel')}>
                                Export Data as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleScheduleReport}>
                                Schedule Report
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Executive Summary */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                    Executive Summary
                </h2>
                <StatsCardGrid columns={4}>
                    <StatsCard
                        title="Total Revenue"
                        value={data.totalRevenue}
                        metricType="currency"
                        percentageChange={data.revenueGrowth}
                        timePeriod="month"
                        icon={CurrencyDollarIcon}
                        variant="revenue"
                        showTrend
                    />
                    <StatsCard
                        title="Total Users"
                        value={data.totalUsers}
                        metricType="count"
                        percentageChange={data.userGrowth}
                        timePeriod="month"
                        icon={UsersIcon}
                        variant="growth"
                        showTrend
                    />
                    <StatsCard
                        title="Active Users"
                        value={data.activeUsers}
                        metricType="count"
                        subtitle="Last 7 days"
                        icon={EyeIcon}
                        variant="engagement"
                    />
                    <StatsCard
                        title="Engagement Rate"
                        value={data.engagementRate}
                        metricType="percentage"
                        subtitle="Average session time"
                        icon={ChartBarIcon}
                        variant="metric"
                    />
                </StatsCardGrid>
            </div>

            {/* Real-time Metrics */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                    Real-time Metrics
                </h2>
                <CompactStatsRow
                    stats={[
                        {
                            label: 'Current Active Users',
                            value: data.currentActiveUsers,
                            metricType: 'count'
                        },
                        {
                            label: 'Live Streaming Sessions',
                            value: data.liveStreamingSessions,
                            metricType: 'count'
                        },
                        {
                            label: 'System Response Time',
                            value: `${data.systemHealth.responseTime}ms`,
                            metricType: 'count'
                        },
                        {
                            label: 'System Uptime',
                            value: data.systemHealth.uptime,
                            metricType: 'percentage'
                        }
                    ]}
                />
            </div>

            {/* Interactive Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Growth Chart */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <CurrencyDollarIcon className="h-5 w-5 text-success-400" />
                            Revenue Growth Over Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={data.revenueOverTime}>
                                <defs>
                                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={chartColors.success} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#9CA3AF" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1F2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F9FAFB'
                                    }}
                                    formatter={(value: number, name: string) => [
                                        name === 'revenue' ? `$${value.toLocaleString()}` : value,
                                        name === 'revenue' ? 'Revenue' : 'Subscriptions'
                                    ]}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke={chartColors.success}
                                    fillOpacity={1}
                                    fill="url(#revenueGradient)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* User Growth Chart */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-primary-400" />
                            User Acquisition & Churn
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={data.userGrowthOverTime}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#9CA3AF" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1F2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F9FAFB'
                                    }}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="newUsers"
                                    stroke={chartColors.primary}
                                    strokeWidth={2}
                                    name="New Users"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="churn"
                                    stroke={chartColors.error}
                                    strokeWidth={2}
                                    name="Churn"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Video Engagement Chart */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <VideoCameraIcon className="h-5 w-5 text-info-400" />
                            Top Video Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.videoEngagement} layout="horizontal">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                                <YAxis
                                    type="category"
                                    dataKey="title"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    width={120}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1F2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F9FAFB'
                                    }}
                                />
                                <Bar dataKey="views" fill={chartColors.info} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Geographic Distribution */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <GlobeAltIcon className="h-5 w-5 text-warning-400" />
                            Geographic Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data.geographicData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="users"
                                    label={({ region, percent }) => `${region} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {data.geographicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={Object.values(chartColors)[index % Object.values(chartColors).length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1F2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F9FAFB'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Subscription Breakdown & System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Subscription Breakdown */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle>Subscription Tier Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.subscriptionBreakdown.map((tier) => (
                                <div key={tier.tier} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded"
                                            style={{ backgroundColor: tier.color }}
                                        />
                                        <span className="text-neutral-200">{tier.tier}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-neutral-0 font-semibold">
                                            {tier.count} users
                                        </div>
                                        <div className="text-neutral-400 text-sm">
                                            ${tier.revenue.toLocaleString()}/mo
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* System Health */}
                <Card className="p-6">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <ServerIcon className="h-5 w-5 text-neutral-400" />
                            System Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-300">CPU Usage</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-neutral-700 rounded-full">
                                        <div
                                            className="h-2 bg-primary-500 rounded-full transition-all"
                                            style={{ width: `${data.systemHealth.cpuUsage}%` }}
                                        />
                                    </div>
                                    <span className="text-neutral-0 text-sm w-10">
                                        {data.systemHealth.cpuUsage}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-neutral-300">Memory Usage</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-neutral-700 rounded-full">
                                        <div
                                            className="h-2 bg-warning-500 rounded-full transition-all"
                                            style={{ width: `${data.systemHealth.memoryUsage}%` }}
                                        />
                                    </div>
                                    <span className="text-neutral-0 text-sm w-10">
                                        {data.systemHealth.memoryUsage}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-neutral-300">Disk Usage</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-neutral-700 rounded-full">
                                        <div
                                            className="h-2 bg-success-500 rounded-full transition-all"
                                            style={{ width: `${data.systemHealth.diskUsage}%` }}
                                        />
                                    </div>
                                    <span className="text-neutral-0 text-sm w-10">
                                        {data.systemHealth.diskUsage}%
                                    </span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-neutral-700">
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-300">Uptime</span>
                                    <Badge variant="success">{data.systemHealth.uptime}%</Badge>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-neutral-300">Active Errors</span>
                                    <Badge variant={data.systemHealth.errors > 0 ? "error" : "success"}>
                                        {data.systemHealth.errors}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="p-6">
                <CardHeader className="pb-4">
                    <CardTitle>Recent Subscription Changes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data.recentSubscriptionChanges.map((change, index) => (
                            <div key={index} className="text-center p-4 bg-neutral-800/50 rounded-lg">
                                <div className={cn(
                                    "text-2xl font-bold mb-1",
                                    change.type === 'new' && "text-success-400",
                                    change.type === 'upgrade' && "text-primary-400",
                                    change.type === 'downgrade' && "text-warning-400",
                                    change.type === 'cancelled' && "text-error-400"
                                )}>
                                    {change.count}
                                </div>
                                <div className="text-sm text-neutral-400 capitalize">
                                    {change.type === 'new' ? 'New Subscriptions' :
                                        change.type === 'upgrade' ? 'Upgrades' :
                                            change.type === 'downgrade' ? 'Downgrades' : 'Cancellations'}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 