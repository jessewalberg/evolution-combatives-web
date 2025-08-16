/**
 * Evolution Combatives User Table Component
 * Professional user management interface for tactical training platform
 * Designed for admin dashboard user administration
 * 
 * @description Comprehensive user management table with advanced features
 * @author Evolution Combatives
 */

import * as React from 'react'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'
import { Avatar } from '../ui/avatar'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TablePagination
} from '../ui/table'
import { LoadingOverlay, TableSkeleton } from '../ui/loading'
import {
    UserIcon,
    PencilIcon,
    EnvelopeIcon,
    ChartBarIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    XMarkIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ClockIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline'

/**
 * User status types
 */
type UserStatus = 'active' | 'suspended' | 'pending' | 'inactive'

/**
 * Admin role types
 */
type AdminRole = 'super_admin' | 'content_admin' | 'support_admin' | null

/**
 * Activity status types
 */
type ActivityStatus = 'online' | 'recent' | 'inactive' | 'dormant'

/**
 * Activity event interface
 */
interface ActivityEvent {
    id: string
    type: 'login' | 'logout' | 'video_watch' | 'subscription_change' | 'profile_update'
    timestamp: string
    details?: Record<string, unknown>
}

/**
 * Subscription event interface
 */
interface SubscriptionEvent {
    id: string
    tier: 'beginner' | 'intermediate' | 'advanced' | null
    status: 'active' | 'expired' | 'cancelled' | 'pending'
    startDate: string
    endDate?: string
    amount?: number
}

/**
 * User interface
 */
interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl?: string
    subscriptionTier: 'beginner' | 'intermediate' | 'advanced' | null
    adminRole: AdminRole
    status: UserStatus
    activityStatus: ActivityStatus
    joinDate: string
    lastActive: string
    totalVideosWatched: number
    completionRate: number // percentage
    subscriptionExpiresAt?: string
    location?: string
    department?: string
    phoneNumber?: string
    isEmailVerified: boolean
    totalProgress: number // percentage
    badgeNumber?: string
    engagementLevel: 'high' | 'medium' | 'low'
    loginHistory: ActivityEvent[]
    subscriptionHistory: SubscriptionEvent[]
    totalWatchTime: number // in minutes
    streakDays: number
    lastLogin?: string
}

/**
 * Sort configuration
 */
interface SortConfig {
    key: keyof User | null
    direction: 'asc' | 'desc'
}

/**
 * Filter configuration
 */
interface FilterConfig {
    status: UserStatus[]
    tier: string[]
    adminRole: string[]
    activityStatus: ActivityStatus[]
    dateRange: {
        start: string
        end: string
    }
}

/**
 * User table props
 */
interface UserTableProps {
    /**
     * User data
     */
    users: User[]

    /**
     * Loading state
     */
    loading?: boolean

    /**
     * Page size for pagination
     */
    pageSize?: number

    /**
     * User action callbacks
     */
    onViewProfile?: (user: User) => void
    onEditSubscription?: (user: User) => void
    onSendMessage?: (user: User) => void
    onSuspendUser?: (user: User) => void
    onActivateUser?: (user: User) => void
    onViewAnalytics?: (user: User) => void
    onExportUser?: (user: User) => void
    onBulkAction?: (action: string, users: User[]) => void

    /**
     * Additional CSS classes
     */
    className?: string
}

/**
 * Subscription tier options
 */
const SUBSCRIPTION_TIERS = [
    { value: 'beginner', label: 'Beginner ($9)', color: 'info' },
    { value: 'intermediate', label: 'Intermediate ($19)', color: 'warning' },
    { value: 'advanced', label: 'Advanced ($49)', color: 'success' },
    { value: 'none', label: 'None', color: 'secondary' },
] as const

/**
 * User status options
 */
const USER_STATUSES = [
    { value: 'active', label: 'Active', color: 'success', icon: CheckCircleIcon },
    { value: 'suspended', label: 'Suspended', color: 'error', icon: ExclamationTriangleIcon },
    { value: 'pending', label: 'Pending', color: 'warning', icon: ClockIcon },
    { value: 'inactive', label: 'Inactive', color: 'secondary', icon: UserIcon },
] as const

/**
 * Admin role options
 */
const ADMIN_ROLES = [
    { value: 'super_admin', label: 'Super Admin', color: 'error' },
    { value: 'content_admin', label: 'Content Admin', color: 'warning' },
    { value: 'support_admin', label: 'Support Admin', color: 'info' },
] as const

/**
 * Activity status options
 */
const ACTIVITY_STATUSES = [
    { value: 'online', label: 'Online', color: 'success' },
    { value: 'recent', label: 'Recent (24h)', color: 'info' },
    { value: 'inactive', label: 'Inactive (7d)', color: 'warning' },
    { value: 'dormant', label: 'Dormant (30d+)', color: 'secondary' },
] as const

/**
 * Professional User Table Component
 */
const UserTable = React.forwardRef<HTMLDivElement, UserTableProps>(
    ({
        users,
        loading = false,
        pageSize = 20,
        onViewProfile,
        onEditSubscription,
        onSendMessage,
        onSuspendUser,
        onActivateUser,
        onViewAnalytics,
        onBulkAction,
        className,
        ...props
    }, ref) => {
        // State management
        const [searchQuery, setSearchQuery] = useState('')
        const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'joinDate', direction: 'desc' })
        const [filters, setFilters] = useState<FilterConfig>({
            status: [],
            tier: [],
            adminRole: [],
            activityStatus: [],
            dateRange: { start: '', end: '' },
        })
        const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
        const [currentPage, setCurrentPage] = useState(1)
        const [showFilters, setShowFilters] = useState(false)
        const [searchDebounce, setSearchDebounce] = useState('')

        // Debounced search
        useEffect(() => {
            const timer = setTimeout(() => {
                setSearchDebounce(searchQuery)
                setCurrentPage(1) // Reset to first page on search
            }, 300)

            return () => clearTimeout(timer)
        }, [searchQuery])

        /**
         * Format date
         */
        const formatDate = useCallback((dateString: string): string => {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            })
        }, [])

        /**
         * Format relative time
         */
        const formatRelativeTime = useCallback((dateString: string): string => {
            const date = new Date(dateString)
            const now = new Date()
            const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

            if (diffInHours < 1) return 'Just now'
            if (diffInHours < 24) return `${diffInHours}h ago`
            if (diffInHours < 48) return 'Yesterday'
            if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
            return formatDate(dateString)
        }, [formatDate])

        /**
         * Handle sorting
         */
        const handleSort = useCallback((key: keyof User) => {
            setSortConfig(prev => ({
                key,
                direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
            }))
        }, [])

        /**
         * Handle filter change
         */
        const handleFilterChange = useCallback((filterType: keyof FilterConfig, value: string) => {
            setFilters(prev => {
                if (filterType === 'dateRange') return prev

                const currentValues = prev[filterType] as string[]
                const newValues = currentValues.includes(value)
                    ? currentValues.filter(v => v !== value)
                    : [...currentValues, value]

                return {
                    ...prev,
                    [filterType]: newValues,
                }
            })
            setCurrentPage(1) // Reset to first page on filter change
        }, [])

        /**
         * Handle date range filter
         */
        const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
            setFilters(prev => ({
                ...prev,
                dateRange: {
                    ...prev.dateRange,
                    [field]: value,
                }
            }))
            setCurrentPage(1)
        }, [])

        /**
         * Clear all filters
         */
        const clearFilters = useCallback(() => {
            setFilters({
                status: [],
                tier: [],
                adminRole: [],
                activityStatus: [],
                dateRange: { start: '', end: '' },
            })
            setSearchQuery('')
            setCurrentPage(1)
        }, [])

        /**
         * Handle user selection
         */
        const handleUserSelect = useCallback((userId: string, selected: boolean) => {
            setSelectedUsers(prev => {
                const newSet = new Set(prev)
                if (selected) {
                    newSet.add(userId)
                } else {
                    newSet.delete(userId)
                }
                return newSet
            })
        }, [])

        /**
         * Handle select all
         */
        const handleSelectAll = (selected: boolean) => {
            if (selected) {
                setSelectedUsers(new Set(filteredAndSortedUsers.map(u => u.id)))
            } else {
                setSelectedUsers(new Set())
            }
        }

        /**
         * Handle bulk action
         */
        const handleBulkAction = useCallback((action: string) => {
            const selectedUserObjects = users.filter(u => selectedUsers.has(u.id))
            onBulkAction?.(action, selectedUserObjects)
            setSelectedUsers(new Set()) // Clear selection after action
        }, [users, selectedUsers, onBulkAction])

        /**
         * Filter and sort users
         */
        const filteredAndSortedUsers = useMemo(() => {
            let filtered = users

            // Apply search filter
            if (searchDebounce) {
                const query = searchDebounce.toLowerCase()
                filtered = filtered.filter(user =>
                    user.firstName.toLowerCase().includes(query) ||
                    user.lastName.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query) ||
                    user.department?.toLowerCase().includes(query) ||
                    user.location?.toLowerCase().includes(query)
                )
            }

            // Apply filters
            if (filters.status.length > 0) {
                filtered = filtered.filter(user => filters.status.includes(user.status))
            }
            if (filters.tier.length > 0) {
                const tierValues = filters.tier.map(t => t === 'none' ? null : t)
                filtered = filtered.filter(user => tierValues.includes(user.subscriptionTier))
            }
            if (filters.adminRole.length > 0) {
                filtered = filtered.filter(user =>
                    user.adminRole && filters.adminRole.includes(user.adminRole)
                )
            }
            if (filters.activityStatus.length > 0) {
                filtered = filtered.filter(user => filters.activityStatus.includes(user.activityStatus))
            }

            // Apply date range filter
            if (filters.dateRange.start || filters.dateRange.end) {
                filtered = filtered.filter(user => {
                    const joinDate = new Date(user.joinDate)
                    const start = filters.dateRange.start ? new Date(filters.dateRange.start) : null
                    const end = filters.dateRange.end ? new Date(filters.dateRange.end) : null

                    if (start && joinDate < start) return false
                    if (end && joinDate > end) return false
                    return true
                })
            }

            // Apply sorting
            if (sortConfig.key) {
                filtered.sort((a, b) => {
                    const aValue = a[sortConfig.key!]
                    const bValue = b[sortConfig.key!]

                    // Handle undefined/null values
                    if (aValue == null && bValue == null) return 0
                    if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
                    if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

                    if (aValue < bValue) {
                        return sortConfig.direction === 'asc' ? -1 : 1
                    }
                    if (aValue > bValue) {
                        return sortConfig.direction === 'asc' ? 1 : -1
                    }
                    return 0
                })
            }

            return filtered
        }, [users, searchDebounce, filters, sortConfig])

        /**
         * Paginated users
         */
        const paginatedUsers = useMemo(() => {
            const startIndex = (currentPage - 1) * pageSize
            const endIndex = startIndex + pageSize
            return filteredAndSortedUsers.slice(startIndex, endIndex)
        }, [currentPage, pageSize, filteredAndSortedUsers])

        /**
         * Pagination info
         */
        const totalPages = Math.ceil(filteredAndSortedUsers.length / pageSize)
        const hasActiveFilters = Object.values(filters).some(f =>
            Array.isArray(f) ? f.length > 0 : (f.start || f.end)
        ) || searchDebounce

        /**
         * Render sort icon
         */
        const renderSortIcon = (key: keyof User) => {
            if (sortConfig.key !== key) {
                return <ChevronUpIcon className="h-4 w-4 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            }
            return sortConfig.direction === 'asc'
                ? <ChevronUpIcon className="h-4 w-4 text-primary-400" />
                : <ChevronDownIcon className="h-4 w-4 text-primary-400" />
        }

        /**
         * Render status badge
         */
        const renderStatusBadge = (status: UserStatus) => {
            const statusConfig = USER_STATUSES.find(s => s.value === status)
            const IconComponent = statusConfig?.icon || UserIcon

            return (
                <Badge variant={(statusConfig?.color || 'secondary') as 'info' | 'warning' | 'success' | 'error' | 'secondary'}>
                    <IconComponent className="h-3 w-3 mr-1" />
                    {statusConfig?.label || status}
                </Badge>
            )
        }

        /**
         * Render subscription tier badge
         */
        const renderTierBadge = (tier: string | null) => {
            const tierConfig = SUBSCRIPTION_TIERS.find(t =>
                t.value === (tier || 'none')
            )
            return (
                <Badge variant={(tierConfig?.color || 'secondary') as 'info' | 'warning' | 'success' | 'error' | 'secondary'}>
                    {tierConfig?.label || 'None'}
                </Badge>
            )
        }

        /**
         * Render admin role badge
         */
        const renderAdminBadge = (role: AdminRole) => {
            if (!role) return null

            const roleConfig = ADMIN_ROLES.find(r => r.value === role)
            return (
                <Badge variant={(roleConfig?.color || 'secondary') as 'info' | 'warning' | 'success' | 'error' | 'secondary'}>
                    <ShieldCheckIcon className="h-3 w-3 mr-1" />
                    {roleConfig?.label || role}
                </Badge>
            )
        }

        /**
         * Render activity status indicator
         */
        const renderActivityStatus = (status: ActivityStatus) => {
            const statusConfig = ACTIVITY_STATUSES.find(s => s.value === status)
            const colorClass = {
                success: 'bg-green-500',
                info: 'bg-blue-500',
                warning: 'bg-yellow-500',
                secondary: 'bg-neutral-500',
            }[statusConfig?.color || 'secondary']

            return (
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                    <span className="text-xs text-neutral-400">{statusConfig?.label}</span>
                </div>
            )
        }

        if (loading) {
            return (
                <Card className={cn('p-6', className)}>
                    <TableSkeleton rows={pageSize} columns={6} showHeader />
                </Card>
            )
        }

        if (users.length === 0 && !hasActiveFilters) {
            return (
                <Card className={cn('p-12 text-center', className)}>
                    <UserIcon className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-neutral-0 mb-2">No users found</h3>
                    <p className="text-neutral-400">
                        Users will appear here once they register for the platform.
                    </p>
                </Card>
            )
        }

        return (
            <div ref={ref} className={cn('space-y-4', className)} {...props}>
                {/* Search and Filters */}
                <Card className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search users by name, email, department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Filter Toggle */}
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className="shrink-0"
                        >
                            <FunnelIcon className="h-4 w-4 mr-2" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="primary" className="ml-2 px-1 py-0 text-xs">
                                    {Object.values(filters).flat().length}
                                </Badge>
                            )}
                        </Button>

                        {/* Bulk Actions */}
                        {selectedUsers.size > 0 && (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAction('email')}
                                >
                                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                                    Email ({selectedUsers.size})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAction('export')}
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                    Export ({selectedUsers.size})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAction('change-tier')}
                                >
                                    Change Tier ({selectedUsers.size})
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-neutral-700 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                {/* Status Filter */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 mb-2 block">
                                        Status
                                    </label>
                                    <div className="space-y-2">
                                        {USER_STATUSES.map(status => (
                                            <label key={status.value} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.status.includes(status.value)}
                                                    onChange={() => handleFilterChange('status', status.value)}
                                                    className="mr-2 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-neutral-300">{status.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Tier Filter */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 mb-2 block">
                                        Subscription Tier
                                    </label>
                                    <div className="space-y-2">
                                        {SUBSCRIPTION_TIERS.map(tier => (
                                            <label key={tier.value} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.tier.includes(tier.value)}
                                                    onChange={() => handleFilterChange('tier', tier.value)}
                                                    className="mr-2 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-neutral-300">{tier.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Admin Role Filter */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 mb-2 block">
                                        Admin Role
                                    </label>
                                    <div className="space-y-2">
                                        {ADMIN_ROLES.map(role => (
                                            <label key={role.value} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.adminRole.includes(role.value)}
                                                    onChange={() => handleFilterChange('adminRole', role.value)}
                                                    className="mr-2 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-neutral-300">{role.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Activity Status Filter */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 mb-2 block">
                                        Activity Status
                                    </label>
                                    <div className="space-y-2">
                                        {ACTIVITY_STATUSES.map(activity => (
                                            <label key={activity.value} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.activityStatus.includes(activity.value)}
                                                    onChange={() => handleFilterChange('activityStatus', activity.value)}
                                                    className="mr-2 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-neutral-300">{activity.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Date Range Filter */}
                                <div>
                                    <label className="text-sm font-medium text-neutral-300 mb-2 block">
                                        Join Date Range
                                    </label>
                                    <div className="space-y-2">
                                        <Input
                                            type="date"
                                            placeholder="Start date"
                                            value={filters.dateRange.start}
                                            onChange={(e) => handleDateRangeChange('start', e.target.value)}
                                            className="text-sm"
                                        />
                                        <Input
                                            type="date"
                                            placeholder="End date"
                                            value={filters.dateRange.end}
                                            onChange={(e) => handleDateRangeChange('end', e.target.value)}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="text-neutral-400 hover:text-neutral-0"
                                >
                                    <XMarkIcon className="h-4 w-4 mr-2" />
                                    Clear all filters
                                </Button>
                            )}
                        </div>
                    )}
                </Card>

                {/* Results Summary */}
                <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>
                        Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users
                        {hasActiveFilters && ` (filtered from ${users.length} total)`}
                    </span>
                    {selectedUsers.size > 0 && (
                        <span>{selectedUsers.size} users selected</span>
                    )}
                </div>

                {/* Table */}
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-neutral-800/50 transition-colors"
                                    onClick={() => handleSort('firstName')}
                                >
                                    <div className="flex items-center gap-2">
                                        User
                                        {renderSortIcon('firstName')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-neutral-800/50 transition-colors"
                                    onClick={() => handleSort('subscriptionTier')}
                                >
                                    <div className="flex items-center gap-2">
                                        Subscription
                                        {renderSortIcon('subscriptionTier')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-neutral-800/50 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center gap-2">
                                        Status
                                        {renderSortIcon('status')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-neutral-800/50 transition-colors"
                                    onClick={() => handleSort('joinDate')}
                                >
                                    <div className="flex items-center gap-2">
                                        Joined
                                        {renderSortIcon('joinDate')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-neutral-800/50 transition-colors"
                                    onClick={() => handleSort('lastActive')}
                                >
                                    <div className="flex items-center gap-2">
                                        Activity
                                        {renderSortIcon('lastActive')}
                                    </div>
                                </TableHead>
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-neutral-800/50">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.has(user.id)}
                                            onChange={(e) => handleUserSelect(user.id, e.target.checked)}
                                            className="rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                src={user.avatarUrl}
                                                alt={`${user.firstName} ${user.lastName}`}
                                                name={`${user.firstName} ${user.lastName}`}
                                                size="sm"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-neutral-0 truncate">
                                                        {user.firstName} {user.lastName}
                                                    </h4>
                                                    {renderAdminBadge(user.adminRole)}
                                                </div>
                                                <p className="text-sm text-neutral-400 truncate">
                                                    {user.email}
                                                </p>
                                                {user.department && (
                                                    <p className="text-xs text-neutral-500 truncate">
                                                        {user.department}
                                                        {user.location && ` • ${user.location}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {renderTierBadge(user.subscriptionTier)}
                                            {user.subscriptionExpiresAt && (
                                                <p className="text-xs text-neutral-500">
                                                    Expires {formatDate(user.subscriptionExpiresAt)}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {renderStatusBadge(user.status)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="text-neutral-0">{formatDate(user.joinDate)}</div>
                                            <div className="text-neutral-500 text-xs">
                                                {user.totalVideosWatched} videos watched
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="text-sm text-neutral-0">
                                                {formatRelativeTime(user.lastActive)}
                                            </div>
                                            {renderActivityStatus(user.activityStatus)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {onViewProfile && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onViewProfile(user)}
                                                    title="View profile"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {onEditSubscription && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEditSubscription(user)}
                                                    title="Edit subscription"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {onSendMessage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onSendMessage(user)}
                                                    title="Send message"
                                                >
                                                    <EnvelopeIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {onViewAnalytics && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onViewAnalytics(user)}
                                                    title="View analytics"
                                                >
                                                    <ChartBarIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {user.status === 'active' && onSuspendUser && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onSuspendUser(user)}
                                                    title="Suspend user"
                                                    className="text-error-400 hover:text-error-300 hover:bg-error-500/10"
                                                >
                                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {user.status === 'suspended' && onActivateUser && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onActivateUser(user)}
                                                    title="Activate user"
                                                    className="text-success-400 hover:text-success-300 hover:bg-success-500/10"
                                                >
                                                    <CheckCircleIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Empty State for Filtered Results */}
                    {filteredAndSortedUsers.length === 0 && hasActiveFilters && (
                        <div className="p-8 text-center">
                            <MagnifyingGlassIcon className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-neutral-0 mb-2">No users found</h3>
                            <p className="text-neutral-400 mb-4">
                                No users match your current search and filter criteria.
                            </p>
                            <Button variant="outline" onClick={clearFilters}>
                                Clear all filters
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalItems={filteredAndSortedUsers.length}
                        onPageChange={setCurrentPage}
                    />
                )}

                {/* Loading Overlay */}
                <LoadingOverlay
                    isVisible={loading}
                    message="Loading users..."
                />
            </div>
        )
    }
)

UserTable.displayName = 'UserTable'

export default UserTable
export { UserTable }
export type { UserTableProps, User, UserStatus, AdminRole, ActivityStatus } 