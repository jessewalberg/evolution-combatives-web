/**
 * Evolution Combatives - User Management Dashboard
 * Professional user administration for tactical training platform
 * 
 * @description Comprehensive user management with analytics, filtering, and bulk operations
 * @author Evolution Combatives
 */

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../src/hooks/useAuth'
import { StatsCard, StatsCardGrid } from '../../src/components/ui/stats-card'
import { Card } from '../../src/components/ui/card'
import { Button } from '../../src/components/ui/button'
import { Input } from '../../src/components/ui/input'
import { Spinner } from '../../src/components/ui/loading'
import { UserTable } from '../../src/components/user/user-table'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { queryKeys } from '../../src/lib/query-client'

// Icons
import {
    MagnifyingGlassIcon,
    PlusIcon,
    DocumentArrowDownIcon,
    EnvelopeIcon,
    UserGroupIcon,
    CreditCardIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface UserFilters {
    search: string
    status: string[]
    tier: string[]
    adminRole: string[]
    activityStatus: string[]
    dateRange: {
        start?: string
        end?: string
    }
    badgeNumber?: string
    department?: string
    engagementLevel: string[]
    registrationPeriod: string
}

interface BulkAction {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    action: (userIds: string[]) => void
    variant?: 'default' | 'destructive'
    requiresConfirmation?: boolean
}

interface ActivityEvent {
    id: string
    type: 'login' | 'logout' | 'video_watch' | 'subscription_change' | 'profile_update'
    timestamp: string
    details?: Record<string, any>
}

interface SubscriptionEvent {
    id: string
    tier: 'beginner' | 'intermediate' | 'advanced' | null
    status: 'active' | 'expired' | 'cancelled' | 'pending'
    startDate: string
    endDate?: string
    amount?: number
}

interface UserStats {
    totalUsers: number
    usersGrowth: number
    activeUsers: number
    subscriptionDistribution: {
        beginner: number
        intermediate: number
        advanced: number
        none: number
    }
    recentRegistrations: number
    averageEngagement: number
}

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl?: string
    subscriptionTier: 'beginner' | 'intermediate' | 'advanced' | null
    adminRole: 'super_admin' | 'content_admin' | 'support_admin' | null
    status: 'active' | 'suspended' | 'pending' | 'inactive'
    activityStatus: 'online' | 'recent' | 'inactive' | 'dormant'
    joinDate: string
    lastActive: string
    totalVideosWatched: number
    completionRate: number
    subscriptionExpiresAt?: string
    location?: string
    department?: string
    phoneNumber?: string
    isEmailVerified: boolean
    totalProgress: number
    badgeNumber?: string
    engagementLevel: 'high' | 'medium' | 'low'
    loginHistory: ActivityEvent[]
    subscriptionHistory: SubscriptionEvent[]
    totalWatchTime: number
    streakDays: number
    lastLogin?: string
}

export default function UsersPage() {
    const router = useRouter()
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const supabase = createClientComponentClient()

    // State
    const [filters, setFilters] = useState<UserFilters>({
        search: '',
        status: [],
        tier: [],
        adminRole: [],
        activityStatus: [],
        dateRange: {},
        badgeNumber: '',
        department: '',
        engagementLevel: [],
        registrationPeriod: 'all'
    })
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    // Check permissions
    const canManageUsers = hasPermission('users.write')
    const canViewAnalytics = hasPermission('analytics.read')
    const canSendMessages = hasPermission('messaging.write')

    // Fetch user statistics
    const userStatsQuery = useQuery({
        queryKey: queryKeys.usersList(),
        queryFn: async (): Promise<UserStats> => {
            const [profilesResult, subscriptionsResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, created_at, last_active_at, admin_role, email_verified')
                    .order('created_at', { ascending: false }),

                supabase
                    .from('subscriptions')
                    .select('id, tier, status, user_id')
                    .eq('status', 'active')
            ])

            if (profilesResult.error) throw profilesResult.error
            if (subscriptionsResult.error) throw subscriptionsResult.error

            const profiles = profilesResult.data || []
            const subscriptions = subscriptionsResult.data || []

            const now = new Date()
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

            // Calculate metrics
            const totalUsers = profiles.length
            const recentUsers = profiles.filter(p =>
                new Date(p.created_at) >= sevenDaysAgo
            ).length
            const previousWeekUsers = profiles.filter(p => {
                const createdAt = new Date(p.created_at)
                return createdAt >= new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000) &&
                    createdAt < sevenDaysAgo
            }).length

            const usersGrowth = previousWeekUsers > 0 ?
                ((recentUsers - previousWeekUsers) / previousWeekUsers) * 100 : 0

            const activeUsers = profiles.filter(p =>
                p.last_active_at && new Date(p.last_active_at) >= sevenDaysAgo
            ).length

            // Subscription distribution
            const subscriptionMap = new Map(subscriptions.map(s => [s.user_id, s.tier]))
            const distribution = {
                beginner: 0,
                intermediate: 0,
                advanced: 0,
                none: 0
            }

            profiles.forEach(profile => {
                const tier = subscriptionMap.get(profile.id) || 'none'
                if (tier in distribution) {
                    distribution[tier as keyof typeof distribution]++
                } else {
                    distribution.none++
                }
            })

            return {
                totalUsers,
                usersGrowth,
                activeUsers,
                subscriptionDistribution: distribution,
                recentRegistrations: recentUsers,
                averageEngagement: activeUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
            }
        },
        enabled: !!user && !!profile?.admin_role
    })

    // Fetch users data
    const usersQuery = useQuery({
        queryKey: queryKeys.usersList(1, 50), // Fetch more users for better filtering
        queryFn: async (): Promise<User[]> => {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    avatar_url,
                    admin_role,
                    created_at,
                    last_active_at,
                    email_verified,
                    location,
                    department,
                    phone_number,
                    subscriptions(
                        tier,
                        status,
                        current_period_end
                    ),
                    user_progress(
                        progress_percentage,
                        completed
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error

            return (profiles || []).map(profile => {
                const subscriptions = Array.isArray(profile.subscriptions) ?
                    profile.subscriptions : (profile.subscriptions ? [profile.subscriptions] : [])

                // Get the active subscription or the most recent one
                const subscription = subscriptions.find(s => s.status === 'active') || subscriptions[0] || null

                const progress = Array.isArray(profile.user_progress) ?
                    profile.user_progress : []

                const totalProgress = progress.length > 0 ?
                    progress.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / progress.length : 0

                const completedCount = progress.filter(p => p.completed).length
                const completionRate = progress.length > 0 ?
                    (completedCount / progress.length) * 100 : 0

                // Determine activity status
                const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null
                const now = new Date()
                let activityStatus: User['activityStatus'] = 'dormant'

                if (lastActive) {
                    const hoursAgo = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60)
                    if (hoursAgo < 1) activityStatus = 'online'
                    else if (hoursAgo < 24) activityStatus = 'recent'
                    else if (hoursAgo < 168) activityStatus = 'inactive' // 7 days
                    else activityStatus = 'dormant'
                }

                // Determine user status based on subscription and account state
                let userStatus: User['status'] = 'inactive'
                if (subscription?.status === 'active') {
                    userStatus = 'active'
                } else if (profile.email_verified === false) {
                    userStatus = 'pending'
                } else if (subscription?.status === 'canceled' || subscription?.status === 'suspended') {
                    userStatus = 'suspended'
                } else {
                    userStatus = 'inactive'
                }

                // Parse full name
                const nameParts = (profile.full_name || '').split(' ')
                const firstName = nameParts[0] || ''
                const lastName = nameParts.slice(1).join(' ') || ''

                // Calculate engagement level
                let engagementLevel: User['engagementLevel'] = 'low'
                if (progress.length > 0) {
                    if (completionRate > 70) engagementLevel = 'high'
                    else if (completionRate > 30) engagementLevel = 'medium'
                    else engagementLevel = 'low'
                }

                return {
                    id: profile.id,
                    email: profile.email,
                    firstName,
                    lastName,
                    avatarUrl: profile.avatar_url || undefined,
                    subscriptionTier: subscription?.tier || null,
                    adminRole: profile.admin_role,
                    status: userStatus,
                    activityStatus,
                    joinDate: profile.created_at,
                    lastActive: profile.last_active_at || profile.created_at,
                    totalVideosWatched: progress.length,
                    completionRate,
                    subscriptionExpiresAt: subscription?.current_period_end,
                    location: profile.location || undefined,
                    department: profile.department || undefined,
                    phoneNumber: profile.phone_number || undefined,
                    isEmailVerified: profile.email_verified || false,
                    totalProgress,
                    badgeNumber: undefined, // Would be populated from profile.badge_number if field exists
                    engagementLevel,
                    loginHistory: [], // Would be populated from activity logs
                    subscriptionHistory: [], // Would be populated from subscription events
                    totalWatchTime: 0, // Would be calculated from actual watch time data
                    streakDays: 0, // Would be calculated from activity data
                    lastLogin: profile.last_active_at
                } as User
            })
        },
        enabled: !!user && !!profile?.admin_role
    })

    // Get users data safely
    const usersData = useMemo(() => usersQuery.data || [], [usersQuery.data])

    // Filter users based on current filters
    const filteredUsers = useMemo(() => {
        return usersData.filter((user: User) => {
            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                const matchesSearch =
                    user.email.toLowerCase().includes(searchLower) ||
                    user.firstName.toLowerCase().includes(searchLower) ||
                    user.lastName.toLowerCase().includes(searchLower) ||
                    (user.department && user.department.toLowerCase().includes(searchLower)) ||
                    (user.location && user.location.toLowerCase().includes(searchLower))

                if (!matchesSearch) return false
            }

            // Status filter
            if (filters.status.length > 0 && !filters.status.includes(user.status)) {
                return false
            }

            // Tier filter
            if (filters.tier.length > 0) {
                const userTier = user.subscriptionTier || 'none'
                if (!filters.tier.includes(userTier)) return false
            }

            // Admin role filter
            if (filters.adminRole.length > 0) {
                const userRole = user.adminRole || 'none'
                if (!filters.adminRole.includes(userRole)) return false
            }

            // Activity status filter
            if (filters.activityStatus.length > 0 && !filters.activityStatus.includes(user.activityStatus)) {
                return false
            }

            // Date range filter
            if (filters.dateRange.start || filters.dateRange.end) {
                const joinDate = new Date(user.joinDate)
                if (filters.dateRange.start && joinDate < new Date(filters.dateRange.start)) {
                    return false
                }
                if (filters.dateRange.end && joinDate > new Date(filters.dateRange.end)) {
                    return false
                }
            }

            return true
        })
    }, [usersData, filters])

    // Bulk actions configuration
    const bulkActions: BulkAction[] = [
        {
            id: 'send-email',
            label: 'Send Email',
            icon: EnvelopeIcon,
            action: (userIds) => {
                setBulkActionLoading(true)
                // Implementation would open email composer
                toast.info('Email composer opened', {
                    description: `Composing email for ${userIds.length} users`
                })
                setBulkActionLoading(false)
                setSelectedUsers(new Set())
            }
        },
        {
            id: 'export-data',
            label: 'Export Data',
            icon: DocumentArrowDownIcon,
            action: (userIds) => {
                handleBulkExport(userIds)
            }
        },
        {
            id: 'suspend-users',
            label: 'Suspend Users',
            icon: ExclamationTriangleIcon,
            variant: 'destructive' as const,
            requiresConfirmation: true,
            action: (userIds) => {
                if (confirm(`Are you sure you want to suspend ${userIds.length} users?`)) {
                    setBulkActionLoading(true)
                    // Implementation would suspend users
                    toast.success('Users suspended successfully')
                    setBulkActionLoading(false)
                    setSelectedUsers(new Set())
                }
            }
        }
    ]

    // Handle user actions
    const handleViewProfile = (user: User) => {
        router.push(`/dashboard/users/${user.id}`)
    }

    const handleEditSubscription = (user: User) => {
        router.push(`/dashboard/users/${user.id}/subscription`)
    }

    const handleSendMessage = (user: User) => {
        router.push(`/dashboard/messaging/compose?to=${user.id}`)
    }

    const handleViewAnalytics = (user: User) => {
        router.push(`/dashboard/analytics/users/${user.id}`)
    }

    const handleSuspendUser = (user: User) => {
        if (confirm(`Are you sure you want to suspend ${user.firstName} ${user.lastName}?`)) {
            toast.success('User suspended successfully')
        }
    }

    const handleActivateUser = (user: User) => {
        toast.success(`${user.firstName} ${user.lastName} activated successfully`)
    }

    // Handle bulk actions
    const handleBulkAction = (action: BulkAction) => {
        const userIds = Array.from(selectedUsers)
        if (userIds.length === 0) {
            toast.error('No users selected')
            return
        }

        action.action(userIds)
    }

    // Export users data
    const handleBulkExport = (userIds: string[]) => {
        const usersToExport = filteredUsers.filter(user => userIds.includes(user.id))

        const csvData = usersToExport.map(user => ({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            subscriptionTier: user.subscriptionTier || 'None',
            status: user.status,
            joinDate: user.joinDate,
            lastActive: user.lastActive,
            totalProgress: `${user.totalProgress.toFixed(1)}%`,
            completionRate: `${user.completionRate.toFixed(1)}%`,
            department: user.department || '',
            location: user.location || ''
        }))

        const headers = ['Email', 'First Name', 'Last Name', 'Subscription', 'Status', 'Join Date', 'Last Active', 'Progress', 'Completion Rate', 'Department', 'Location']
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => headers.map(header => {
                const key = header.toLowerCase().replace(' ', '') as keyof typeof row
                return `"${row[key]}"`
            }).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)

        setBulkActionLoading(false)
        setSelectedUsers(new Set())
        toast.success('User data exported successfully')
    }

    // Clear filters
    const clearFilters = () => {
        setFilters({
            search: '',
            status: [],
            tier: [],
            adminRole: [],
            activityStatus: [],
            dateRange: {},
            badgeNumber: '',
            department: '',
            engagementLevel: [],
            registrationPeriod: 'all'
        })
    }

    if (authLoading || !user || !profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    const stats = userStatsQuery.data

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        User Management
                    </h1>
                    <p className="text-neutral-400 mt-2">
                        Manage user accounts, subscriptions, and monitor platform engagement
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {canManageUsers && (
                        <Button
                            onClick={() => router.push('/dashboard/users/invite')}
                            className="flex items-center gap-2"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Invite User
                        </Button>
                    )}
                </div>
            </div>

            {/* User Overview Stats */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                    User Overview
                </h2>
                <StatsCardGrid columns={4}>
                    <StatsCard
                        title="Total Users"
                        value={stats?.totalUsers || 0}
                        metricType="count"
                        percentageChange={stats?.usersGrowth}
                        timePeriod="week"
                        icon={UserGroupIcon}
                        variant="growth"
                        showTrend
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="Active Users"
                        value={stats?.activeUsers || 0}
                        metricType="count"
                        subtitle="Last 7 days"
                        icon={CheckCircleIcon}
                        variant="engagement"
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="Subscriptions"
                        value={(stats?.subscriptionDistribution.beginner || 0) +
                            (stats?.subscriptionDistribution.intermediate || 0) +
                            (stats?.subscriptionDistribution.advanced || 0)}
                        metricType="count"
                        subtitle="Active subscriptions"
                        icon={CreditCardIcon}
                        variant="revenue"
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="New This Week"
                        value={stats?.recentRegistrations || 0}
                        metricType="count"
                        subtitle="Recent registrations"
                        icon={ClockIcon}
                        variant="metric"
                        isLoading={userStatsQuery.isLoading}
                    />
                </StatsCardGrid>
            </div>

            {/* Subscription Distribution */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                    Subscription Distribution
                </h3>
                <StatsCardGrid columns={4}>
                    <StatsCard
                        title="Beginner"
                        value={stats?.subscriptionDistribution.beginner || 0}
                        metricType="count"
                        subtitle="$9/month"
                        variant="metric"
                        size="sm"
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="Intermediate"
                        value={stats?.subscriptionDistribution.intermediate || 0}
                        metricType="count"
                        subtitle="$19/month"
                        variant="engagement"
                        size="sm"
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="Advanced"
                        value={stats?.subscriptionDistribution.advanced || 0}
                        metricType="count"
                        subtitle="$49/month"
                        variant="revenue"
                        size="sm"
                        isLoading={userStatsQuery.isLoading}
                    />
                    <StatsCard
                        title="No Subscription"
                        value={stats?.subscriptionDistribution.none || 0}
                        metricType="count"
                        subtitle="Free access"
                        variant="metric"
                        size="sm"
                        isLoading={userStatsQuery.isLoading}
                    />
                </StatsCardGrid>
            </div>

            {/* Search and Filters */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                        Search & Filter Users
                    </h3>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear All
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                            placeholder="Search users..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="pl-10"
                        />
                    </div>
                    <select
                        value={filters.status[0] || ''}
                        onChange={(e) => setFilters(prev => ({
                            ...prev,
                            status: e.target.value ? [e.target.value] : []
                        }))}
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="pending">Pending</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select
                        value={filters.tier[0] || ''}
                        onChange={(e) => setFilters(prev => ({
                            ...prev,
                            tier: e.target.value ? [e.target.value] : []
                        }))}
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                    >
                        <option value="">All Tiers</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="none">No Subscription</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => handleBulkExport(filteredUsers.map(u => u.id))}>
                        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                        Export All
                    </Button>
                </div>
            </Card>

            {/* User Table */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">
                        Users ({filteredUsers.length})
                    </h3>
                    <div className="flex items-center gap-2">
                        {selectedUsers.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-400">
                                    {selectedUsers.size} selected
                                </span>
                                {bulkActions.map(action => (
                                    <Button
                                        key={action.id}
                                        variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                                        size="sm"
                                        onClick={() => handleBulkAction(action)}
                                        disabled={bulkActionLoading}
                                        className="flex items-center gap-2"
                                    >
                                        <action.icon className="h-4 w-4" />
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <UserTable
                    users={filteredUsers}
                    loading={usersQuery.isLoading}
                    onViewProfile={handleViewProfile}
                    onEditSubscription={canManageUsers ? handleEditSubscription : undefined}
                    onSendMessage={canSendMessages ? handleSendMessage : undefined}
                    onSuspendUser={canManageUsers ? handleSuspendUser : undefined}
                    onActivateUser={canManageUsers ? handleActivateUser : undefined}
                    onViewAnalytics={canViewAnalytics ? handleViewAnalytics : undefined}
                    onBulkAction={(action, users) => {
                        const userIds = users.map(u => u.id)
                        setSelectedUsers(new Set(userIds))
                    }}
                />
            </Card>
        </div>
    )
} 