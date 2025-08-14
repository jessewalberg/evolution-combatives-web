/**
 * Evolution Combatives Table Example
 * Comprehensive demonstration of all table features
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Example component showcasing table system capabilities
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
    TableSkeleton,
    TableEmptyState,
    TableSelection,
    type SortConfig
} from './ui/table'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

// Sample data interfaces for demonstration
interface User {
    id: string
    name: string
    email: string
    role: 'super_admin' | 'content_admin' | 'support_admin' | 'user'
    subscription: 'None' | 'Beginner' | 'Intermediate' | 'Advanced'
    joinDate: string
    lastActive: string
    status: 'active' | 'inactive' | 'suspended'
}

interface Video {
    id: string
    title: string
    discipline: string
    category: string
    instructor: string
    duration: number
    views: number
    uploadDate: string
    status: 'published' | 'draft' | 'processing' | 'archived'
}

// Sample data for demonstration
const sampleUsers: User[] = [
    {
        id: '1',
        name: 'John Smith',
        email: 'john.smith@police.gov',
        role: 'super_admin',
        subscription: 'Advanced',
        joinDate: '2024-01-15',
        lastActive: '2024-03-10',
        status: 'active'
    },
    {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah.j@military.mil',
        role: 'content_admin',
        subscription: 'Intermediate',
        joinDate: '2024-02-01',
        lastActive: '2024-03-09',
        status: 'active'
    },
    {
        id: '3',
        name: 'Mike Wilson',
        email: 'mike.wilson@training.org',
        role: 'support_admin',
        subscription: 'Beginner',
        joinDate: '2024-02-15',
        lastActive: '2024-03-08',
        status: 'inactive'
    },
    {
        id: '4',
        name: 'Lisa Anderson',
        email: 'lisa.a@enforcement.gov',
        role: 'user',
        subscription: 'Intermediate',
        joinDate: '2024-03-01',
        lastActive: '2024-03-10',
        status: 'active'
    },
    {
        id: '5',
        name: 'David Brown',
        email: 'david.brown@tactical.mil',
        role: 'user',
        subscription: 'None',
        joinDate: '2024-03-05',
        lastActive: '2024-03-07',
        status: 'suspended'
    }
]

const sampleVideos: Video[] = [
    {
        id: '1',
        title: 'Tactical Handgun Fundamentals',
        discipline: 'Firearms',
        category: 'Basic Training',
        instructor: 'SGT Martinez',
        duration: 1800, // 30 minutes in seconds
        views: 2500,
        uploadDate: '2024-02-01',
        status: 'published'
    },
    {
        id: '2',
        title: 'Close Quarters Combat',
        discipline: 'Hand-to-Hand',
        category: 'Advanced Techniques',
        instructor: 'LT Johnson',
        duration: 2700, // 45 minutes
        views: 1800,
        uploadDate: '2024-02-15',
        status: 'published'
    },
    {
        id: '3',
        title: 'Defensive Tactics Overview',
        discipline: 'Defensive Tactics',
        category: 'Fundamentals',
        instructor: 'CPT Williams',
        duration: 2100, // 35 minutes
        views: 0,
        uploadDate: '2024-03-10',
        status: 'draft'
    }
]

/**
 * Format duration from seconds to MM:SS format
 */
const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Format date to readable format
 */
const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

/**
 * Get status badge styling
 */
const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'

    switch (status) {
        case 'active':
        case 'published':
            return `${baseClasses} bg-success-600/20 text-success-400 border border-success-600/30`
        case 'inactive':
        case 'draft':
            return `${baseClasses} bg-warning-600/20 text-warning-400 border border-warning-600/30`
        case 'suspended':
        case 'archived':
            return `${baseClasses} bg-error-600/20 text-error-400 border border-error-600/30`
        case 'processing':
            return `${baseClasses} bg-primary-600/20 text-primary-400 border border-primary-600/30`
        default:
            return `${baseClasses} bg-neutral-600/20 text-neutral-400 border border-neutral-600/30`
    }
}

/**
 * Get subscription badge styling
 */
const getSubscriptionBadge = (subscription: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium'

    switch (subscription) {
        case 'Advanced':
            return `${baseClasses} bg-primary-600/20 text-primary-400 border border-primary-600/30`
        case 'Intermediate':
            return `${baseClasses} bg-success-600/20 text-success-400 border border-success-600/30`
        case 'Beginner':
            return `${baseClasses} bg-warning-600/20 text-warning-400 border border-warning-600/30`
        case 'None':
            return `${baseClasses} bg-neutral-600/20 text-neutral-400 border border-neutral-600/30`
        default:
            return `${baseClasses} bg-neutral-600/20 text-neutral-400 border border-neutral-600/30`
    }
}

/**
 * Table Example Component
 */
const TableExample: React.FC = () => {
    // State for user table
    const [userSort, setUserSort] = React.useState<SortConfig>({ key: 'name', direction: 'asc' })
    const [selectedUsers, setSelectedUsers] = React.useState<Set<string>>(new Set())
    const [userPage, setUserPage] = React.useState(1)
    const [userPageSize, setUserPageSize] = React.useState(10)
    const [userLoading, setUserLoading] = React.useState(false)

    // State for video table
    const [videoSort, setVideoSort] = React.useState<SortConfig>({ key: 'title', direction: 'asc' })
    const [videoLoading, setVideoLoading] = React.useState(false)

    // State for demo controls
    const [showEmptyState, setShowEmptyState] = React.useState(false)

    // Sort users
    const sortedUsers = React.useMemo(() => {
        if (!userSort.direction) return sampleUsers

        return [...sampleUsers].sort((a, b) => {
            const aValue = a[userSort.key as keyof User]
            const bValue = b[userSort.key as keyof User]

            if (aValue < bValue) return userSort.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return userSort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [userSort])

    // Sort videos
    const sortedVideos = React.useMemo(() => {
        if (!videoSort.direction) return sampleVideos

        return [...sampleVideos].sort((a, b) => {
            const aValue = a[videoSort.key as keyof Video]
            const bValue = b[videoSort.key as keyof Video]

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return videoSort.direction === 'asc' ? aValue - bValue : bValue - aValue
            }

            if (aValue < bValue) return videoSort.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return videoSort.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [videoSort])

    // Paginated users
    const paginatedUsers = React.useMemo(() => {
        const startIndex = (userPage - 1) * userPageSize
        return sortedUsers.slice(startIndex, startIndex + userPageSize)
    }, [sortedUsers, userPage, userPageSize])

    // Show all videos (no pagination for video table)
    const paginatedVideos = sortedVideos

    // Handle user sorting
    const handleUserSort = (key: string) => {
        setUserSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    // Handle video sorting
    const handleVideoSort = (key: string) => {
        setVideoSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    // Handle user selection
    const handleUserSelection = (userId: string, selected: boolean) => {
        const newSelected = new Set(selectedUsers)
        if (selected) {
            newSelected.add(userId)
        } else {
            newSelected.delete(userId)
        }
        setSelectedUsers(newSelected)
    }

    // Handle select all users
    const handleSelectAllUsers = (selected: boolean) => {
        if (selected) {
            setSelectedUsers(new Set(paginatedUsers.map(user => user.id)))
        } else {
            setSelectedUsers(new Set())
        }
    }

    // Handle bulk actions
    const handleBulkDelete = () => {
        alert(`Would delete ${selectedUsers.size} selected users`)
        setSelectedUsers(new Set())
    }

    // Simulate loading
    const simulateLoading = (type: 'users' | 'videos') => {
        if (type === 'users') {
            setUserLoading(true)
            setTimeout(() => setUserLoading(false), 2000)
        } else {
            setVideoLoading(true)
            setTimeout(() => setVideoLoading(false), 2000)
        }
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-0">Table Components</h1>
                <p className="text-neutral-400">
                    Professional data tables with sorting, pagination, selection, and loading states.
                </p>
            </div>

            {/* Demo Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Demo Controls</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    <Button
                        variant="outline"
                        onClick={() => simulateLoading('users')}
                        disabled={userLoading}
                    >
                        {userLoading ? 'Loading...' : 'Simulate User Loading'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => simulateLoading('videos')}
                        disabled={videoLoading}
                    >
                        {videoLoading ? 'Loading...' : 'Simulate Video Loading'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowEmptyState(!showEmptyState)}
                    >
                        {showEmptyState ? 'Show Data' : 'Show Empty State'}
                    </Button>
                    {selectedUsers.size > 0 && (
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                        >
                            Delete {selectedUsers.size} Selected
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <TableSelection
                                        checked={paginatedUsers.length > 0 && selectedUsers.size === paginatedUsers.length}
                                        indeterminate={selectedUsers.size > 0 && selectedUsers.size < paginatedUsers.length}
                                        onChange={handleSelectAllUsers}
                                    />
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'name' ? userSort.direction : null}
                                    onSort={() => handleUserSort('name')}
                                >
                                    Name
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'email' ? userSort.direction : null}
                                    onSort={() => handleUserSort('email')}
                                >
                                    Email
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'role' ? userSort.direction : null}
                                    onSort={() => handleUserSort('role')}
                                >
                                    Role
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'subscription' ? userSort.direction : null}
                                    onSort={() => handleUserSort('subscription')}
                                >
                                    Subscription
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'joinDate' ? userSort.direction : null}
                                    onSort={() => handleUserSort('joinDate')}
                                >
                                    Join Date
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={userSort.key === 'status' ? userSort.direction : null}
                                    onSort={() => handleUserSort('status')}
                                >
                                    Status
                                </TableHead>
                                <TableHead align="right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userLoading ? (
                                <TableSkeleton rows={5} columns={8} />
                            ) : showEmptyState ? (
                                <TableEmptyState
                                    title="No users found"
                                    description="There are currently no users in the system. Add new users to get started."
                                    icon={
                                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                        </svg>
                                    }
                                    action={{
                                        label: 'Add User',
                                        onClick: () => alert('Would open add user dialog')
                                    }}
                                />
                            ) : (
                                paginatedUsers.map((user) => (
                                    <TableRow
                                        key={user.id}
                                        selected={selectedUsers.has(user.id)}
                                    >
                                        <TableCell>
                                            <TableSelection
                                                checked={selectedUsers.has(user.id)}
                                                onChange={(selected) => handleUserSelection(user.id, selected)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <span className="capitalize">{user.role.replace('_', ' ')}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={getSubscriptionBadge(user.subscription)}>
                                                {user.subscription}
                                            </span>
                                        </TableCell>
                                        <TableCell>{formatDate(user.joinDate)}</TableCell>
                                        <TableCell>
                                            <span className={getStatusBadge(user.status)}>
                                                {user.status}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex gap-2 justify-end">
                                                <Button size="xs" variant="outline">
                                                    Edit
                                                </Button>
                                                <Button size="xs" variant="destructive">
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableCaption>
                            User management table with sorting, selection, and pagination.
                        </TableCaption>
                    </Table>

                    {!userLoading && !showEmptyState && (
                        <div className="border-t border-neutral-700">
                            <div className="flex items-center justify-between px-4 py-3 bg-neutral-800">
                                <div className="flex items-center gap-4 text-sm text-neutral-400">
                                    <span>
                                        Showing {((userPage - 1) * userPageSize) + 1}-{Math.min(userPage * userPageSize, sampleUsers.length)} of {sampleUsers.length} users
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span>Show</span>
                                        <select
                                            value={userPageSize}
                                            onChange={(e) => setUserPageSize(Number(e.target.value))}
                                            className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-neutral-0 text-sm"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                        </select>
                                        <span>per page</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => setUserPage(Math.max(1, userPage - 1))}
                                        disabled={userPage <= 1}
                                    >
                                        Previous
                                    </Button>

                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.ceil(sampleUsers.length / userPageSize) }, (_, i) => i + 1).map((page) => (
                                            <Button
                                                key={page}
                                                size="xs"
                                                variant={page === userPage ? 'primary' : 'outline'}
                                                onClick={() => setUserPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        ))}
                                    </div>

                                    <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => setUserPage(Math.min(Math.ceil(sampleUsers.length / userPageSize), userPage + 1))}
                                        disabled={userPage >= Math.ceil(sampleUsers.length / userPageSize)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Videos Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Video Content Management</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table variant="bordered">
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'title' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('title')}
                                >
                                    Title
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'discipline' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('discipline')}
                                >
                                    Discipline
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'instructor' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('instructor')}
                                >
                                    Instructor
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'duration' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('duration')}
                                    align="center"
                                >
                                    Duration
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'views' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('views')}
                                    align="right"
                                >
                                    Views
                                </TableHead>
                                <TableHead
                                    sortable
                                    sortDirection={videoSort.key === 'uploadDate' ? videoSort.direction : null}
                                    onSort={() => handleVideoSort('uploadDate')}
                                >
                                    Upload Date
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead align="right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {videoLoading ? (
                                <TableSkeleton rows={3} columns={8} />
                            ) : (
                                paginatedVideos.map((video) => (
                                    <TableRow key={video.id}>
                                        <TableCell className="font-medium">{video.title}</TableCell>
                                        <TableCell>{video.discipline}</TableCell>
                                        <TableCell>{video.instructor}</TableCell>
                                        <TableCell align="center">{formatDuration(video.duration)}</TableCell>
                                        <TableCell align="right">{video.views.toLocaleString()}</TableCell>
                                        <TableCell>{formatDate(video.uploadDate)}</TableCell>
                                        <TableCell>
                                            <span className={getStatusBadge(video.status)}>
                                                {video.status}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex gap-2 justify-end">
                                                <Button size="xs" variant="outline">
                                                    Edit
                                                </Button>
                                                <Button size="xs" variant="ghost">
                                                    Preview
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

export default TableExample 