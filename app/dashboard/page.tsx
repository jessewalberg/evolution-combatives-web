/**
 * Evolution Combatives - Admin Dashboard Overview
 * Main dashboard page for tactical training platform administration
 * 
 * @description Dashboard overview with key metrics, quick actions, and activity feed
 * @author Evolution Combatives
 */

'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../src/hooks/useAuth'
import ROUTES from '../../src/lib/routes'
import { StatsCard, StatsCardGrid } from '../../src/components/ui/stats-card'
import { Card } from '../../src/components/ui/card'
import { Button } from '../../src/components/ui/button'
import { Spinner } from '../../src/components/ui/loading'
import { cn } from '../../src/lib/utils'

// Icons
import {
    UsersIcon,
    CreditCardIcon,
    VideoCameraIcon,
    ChartBarIcon,
    PlusIcon,
    UserPlusIcon,
    ChatBubbleLeftRightIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    EyeIcon,
    ArrowPathIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface DashboardMetrics {
    totalUsers: number
    totalUsersGrowth: number
    activeSubscriptions: number
    monthlyRevenue: number
    revenueGrowth: number
    totalVideos: number
    videosThisMonth: number
    avgEngagementTime: number
    engagementGrowth: number
    processingVideos: number
    pendingQA: number
    systemAlerts: number
}

interface RecentActivity {
    id: string
    type: 'user_registration' | 'video_upload' | 'video_processed' | 'qa_submission' | 'system_alert'
    title: string
    description: string
    timestamp: string
    user?: string
    metadata?: Record<string, unknown>
}

interface QuickAction {
    id: string
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    href?: string
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'outline'
    permissions?: string[]
}

export default function DashboardPage() {
    const router = useRouter()
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()

    // Dashboard metrics query
    const metricsQuery = useQuery({
        queryKey: ['dashboard', 'metrics'],
        queryFn: async () => {
            const response = await fetch('/api/dashboard/metrics', {
                credentials: 'include'
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch dashboard metrics: ${response.status}`)
            }

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch dashboard metrics')
            }

            return result.data as DashboardMetrics
        },
        staleTime: 30 * 60 * 1000, // 30 minutes - metrics don't change that often
        gcTime: 60 * 60 * 1000, // 1 hour - keep in cache longer
        refetchOnWindowFocus: false, // Don't refetch when returning to tab
        refetchOnMount: false, // Don't refetch if data exists in cache
        enabled: !!user && !!profile?.admin_role
    })

    // Recent activity query
    const activityQuery = useQuery({
        queryKey: ['dashboard', 'activity'],
        queryFn: async () => {
            // This would typically come from an activity log table
            // For now, we'll create mock data based on recent database changes
            const activities: RecentActivity[] = [
                {
                    id: '1',
                    type: 'user_registration',
                    title: 'New User Registration',
                    description: 'john.doe@police.gov joined with Intermediate subscription',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    user: 'john.doe@police.gov'
                },
                {
                    id: '2',
                    type: 'video_processed',
                    title: 'Video Processing Complete',
                    description: 'Advanced Defensive Tactics - Module 3 is now available',
                    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                },
                {
                    id: '3',
                    type: 'qa_submission',
                    title: 'New Q&A Submission',
                    description: 'Question about firearm safety protocols',
                    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                },
                {
                    id: '4',
                    type: 'video_upload',
                    title: 'Video Upload Started',
                    description: 'Combat Fitness Training - Week 1 (Processing)',
                    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                },
                {
                    id: '5',
                    type: 'system_alert',
                    title: 'System Alert',
                    description: 'High CDN usage detected - 85% of monthly quota',
                    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
                }
            ]

            return activities
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - activity doesn't change super frequently
        gcTime: 30 * 60 * 1000, // 30 minutes - keep activity in cache
        refetchOnWindowFocus: false, // Don't refetch when returning to tab
        refetchOnMount: false, // Don't refetch if data exists in cache
        enabled: !!user && !!profile?.admin_role
    })

    // Manual refresh function
    const handleRefresh = async () => {
        await Promise.all([
            metricsQuery.refetch(),
            activityQuery.refetch()
        ])
    }

    const isRefreshing = metricsQuery.isFetching || activityQuery.isFetching

    // Quick actions configuration
    const quickActions: QuickAction[] = [
        {
            id: 'upload-video',
            title: 'Upload Video',
            description: 'Add new training content',
            icon: VideoCameraIcon,
            href: '/dashboard/content/videos/upload',
            variant: 'primary',
            permissions: ['content.write']
        },
        {
            id: 'add-user',
            title: 'Add User',
            description: 'Create new admin account',
            icon: UserPlusIcon,
            href: '/dashboard/users/create',
            variant: 'secondary',
            permissions: ['users.write']
        },
        {
            id: 'answer-qa',
            title: 'Answer Q&A',
            description: `${metricsQuery.data?.pendingQA || 0} pending questions`,
            icon: ChatBubbleLeftRightIcon,
            href: '/dashboard/qa',
            variant: 'outline',
            permissions: ['support.write']
        },
        {
            id: 'view-analytics',
            title: 'View Analytics',
            description: 'Check performance metrics',
            icon: ChartBarIcon,
            href: '/dashboard/analytics',
            variant: 'outline',
            permissions: ['analytics.read']
        }
    ]

    // Filter quick actions based on permissions
    const availableActions = quickActions.filter(action =>
        !action.permissions || action.permissions.some(permission => hasPermission(permission))
    )

    // Handle quick action clicks
    const handleQuickAction = (action: QuickAction) => {
        if (action.onClick) {
            action.onClick()
        } else if (action.href) {
            router.push(action.href)
        }
    }

    // Format activity timestamp
    const formatActivityTime = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

        if (diffInHours < 1) return 'Just now'
        if (diffInHours < 24) return `${diffInHours}h ago`
        return date.toLocaleDateString()
    }

    // Get activity icon
    const getActivityIcon = (type: RecentActivity['type']) => {
        switch (type) {
            case 'user_registration':
                return UsersIcon
            case 'video_upload':
                return VideoCameraIcon
            case 'video_processed':
                return CheckCircleIcon
            case 'qa_submission':
                return ChatBubbleLeftRightIcon
            case 'system_alert':
                return ExclamationTriangleIcon
            default:
                return ClockIcon
        }
    }

    // Get activity color
    const getActivityColor = (type: RecentActivity['type']) => {
        switch (type) {
            case 'user_registration':
                return 'text-green-600 dark:text-green-400'
            case 'video_upload':
                return 'text-blue-600 dark:text-blue-400'
            case 'video_processed':
                return 'text-green-600 dark:text-green-400'
            case 'qa_submission':
                return 'text-yellow-600 dark:text-yellow-400'
            case 'system_alert':
                return 'text-red-600 dark:text-red-400'
            default:
                return 'text-muted-foreground'
        }
    }

    // Dashboard is working properly

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                        Access Denied
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        Your account does not have admin permissions.
                    </p>
                    <p className="text-sm text-muted-foreground/70">
                        Current role: {profile?.admin_role || 'none'} | User: {user.email}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        Dashboard Overview
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Welcome back, {profile.full_name || user.email}. Here&apos;s what&apos;s happening with your tactical training platform.
                    </p>
                    {metricsQuery.dataUpdatedAt != null && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            Last updated: {new Date(metricsQuery.dataUpdatedAt).toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:mt-6">
                    <Button
                        variant="outline"
                        size="default"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        leftIcon={<ArrowPathIcon className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
                        className="w-full sm:w-auto"
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                    <Button
                        onClick={() => router.push('/dashboard/content/videos')}
                        variant="primary"
                        size="default"
                        leftIcon={<VideoCameraIcon className="h-4 w-4" />}
                        className="w-full sm:w-auto"
                    >
                        Manage Videos
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">
                    Key Metrics
                </h2>
                <StatsCardGrid columns={4}>
                    <StatsCard
                        title="Total Users"
                        value={metricsQuery.data?.totalUsers || 0}
                        metricType="count"
                        previousValue={metricsQuery.data?.totalUsers ?
                            metricsQuery.data.totalUsers - (metricsQuery.data.totalUsersGrowth / 100 * metricsQuery.data.totalUsers) : 0
                        }
                        timePeriod="month"
                        icon={UsersIcon}
                        variant="growth"
                        showTrend
                        isLoading={metricsQuery.isLoading}
                    />
                    <StatsCard
                        title="Active Subscriptions"
                        value={metricsQuery.data?.activeSubscriptions || 0}
                        metricType="count"
                        subtitle="Monthly recurring"
                        icon={CreditCardIcon}
                        variant="engagement"
                        isLoading={metricsQuery.isLoading}
                    />
                    <StatsCard
                        title="Monthly Revenue"
                        value={metricsQuery.data?.monthlyRevenue || 0}
                        metricType="currency"
                        percentageChange={metricsQuery.data?.revenueGrowth}
                        timePeriod="month"
                        icon={ChartBarIcon}
                        variant="revenue"
                        showTrend
                        isLoading={metricsQuery.isLoading}
                    />
                    <StatsCard
                        title="Video Library"
                        value={metricsQuery.data?.totalVideos || 0}
                        metricType="count"
                        subtitle={`+${metricsQuery.data?.videosThisMonth || 0} this month`}
                        icon={VideoCameraIcon}
                        variant="metric"
                        isLoading={metricsQuery.isLoading}
                    />
                </StatsCardGrid>
            </div>

            {/* Secondary Metrics */}
            <div>
                <StatsCardGrid columns={3}>
                    <StatsCard
                        title="Avg. Engagement Time"
                        value={metricsQuery.data?.avgEngagementTime || 0}
                        metricType="duration"
                        percentageChange={metricsQuery.data?.engagementGrowth}
                        timePeriod="month"
                        icon={EyeIcon}
                        size="sm"
                        showTrend
                        isLoading={metricsQuery.isLoading}
                    />
                    <StatsCard
                        title="Processing Videos"
                        value={metricsQuery.data?.processingVideos || 0}
                        metricType="count"
                        subtitle="Currently processing"
                        icon={ClockIcon}
                        size="sm"
                        variant={metricsQuery.data?.processingVideos ? 'engagement' : 'metric'}
                        isLoading={metricsQuery.isLoading}
                    />
                    <StatsCard
                        title="Pending Q&A"
                        value={metricsQuery.data?.pendingQA || 0}
                        metricType="count"
                        subtitle="Awaiting response"
                        icon={ChatBubbleLeftRightIcon}
                        size="sm"
                        variant={metricsQuery.data?.pendingQA ? 'growth' : 'metric'}
                        isLoading={metricsQuery.isLoading}
                    />
                </StatsCardGrid>
            </div>

            {/* Quick Actions and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-card-foreground">
                            Quick Actions
                        </h3>
                        <PlusIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                        {/* Always show video upload button */}
                        <Button
                            onClick={() => router.push(ROUTES.DASHBOARD.CONTENT.VIDEOS)}
                            variant="primary"
                            className="w-full justify-start h-auto p-4"
                            leftIcon={<VideoCameraIcon className="h-5 w-5" />}
                        >
                            <div className="text-left">
                                <div className="font-medium">Upload & Manage Videos</div>
                                <div className="text-sm opacity-90">
                                    Access video library and upload new content
                                </div>
                            </div>
                        </Button>

                        {/* Content Management */}
                        <Button
                            onClick={() => router.push(ROUTES.DASHBOARD.CONTENT.CATEGORIES)}
                            variant="outline"
                            className="w-full justify-start h-auto p-4"
                            leftIcon={<DocumentTextIcon className="h-5 w-5" />}
                        >
                            <div className="text-left">
                                <div className="font-medium">Manage Categories</div>
                                <div className="text-sm opacity-90">
                                    Organize video content by categories
                                </div>
                            </div>
                        </Button>

                        {/* User Management */}
                        <Button
                            onClick={() => router.push(ROUTES.USERS.LIST)}
                            variant="outline"
                            className="w-full justify-start h-auto p-4"
                            leftIcon={<UsersIcon className="h-5 w-5" />}
                        >
                            <div className="text-left">
                                <div className="font-medium">Manage Users</div>
                                <div className="text-sm opacity-90">
                                    View and manage user accounts
                                </div>
                            </div>
                        </Button>

                        {/* Analytics */}
                        <Button
                            onClick={() => router.push(ROUTES.ANALYTICS.HOME)}
                            variant="outline"
                            className="w-full justify-start h-auto p-4"
                            leftIcon={<ChartBarIcon className="h-5 w-5" />}
                        >
                            <div className="text-left">
                                <div className="font-medium">View Analytics</div>
                                <div className="text-sm opacity-90">
                                    Check performance metrics and insights
                                </div>
                            </div>
                        </Button>

                        {availableActions.map((action) => {
                            const Icon = action.icon
                            return (
                                <Button
                                    key={action.id}
                                    variant={action.variant || 'outline'}
                                    className="w-full justify-start h-auto p-4"
                                    onClick={() => handleQuickAction(action)}
                                    leftIcon={<Icon className="h-5 w-5" />}
                                >
                                    <div className="text-left">
                                        <div className="font-medium">{action.title}</div>
                                        <div className="text-sm opacity-90">
                                            {action.description}
                                        </div>
                                    </div>
                                </Button>
                            )
                        })}
                    </div>
                </Card>

                {/* Recent Activity */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-card-foreground">
                            Recent Activity
                        </h3>
                        <Button variant="ghost" size="sm">
                            View All
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {activityQuery.isLoading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-muted rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-muted rounded w-3/4" />
                                                <div className="h-3 bg-muted/60 rounded w-1/2" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            activityQuery.data?.map((activity) => {
                                const Icon = getActivityIcon(activity.type)
                                return (
                                    <div key={activity.id} className="flex items-start gap-3">
                                        <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center',
                                            'bg-muted border border-border'
                                        )}>
                                            <Icon className={cn(
                                                'h-4 w-4',
                                                getActivityColor(activity.type)
                                            )} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-card-foreground">
                                                    {activity.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatActivityTime(activity.timestamp)}
                                                </p>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {activity.description}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
} 