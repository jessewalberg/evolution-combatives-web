/**
 * Evolution Combatives Video Table Component
 * Professional video library management for tactical training content
 * Designed for content administrators managing law enforcement training videos
 * 
 * @description Comprehensive video management table with advanced features
 * @author Evolution Combatives
 */

import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'
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
import { NoVideosEmptyState } from '../ui/empty-state'
import { VideoActionsDropdown } from '../ui/dropdown'
import {
    PlayIcon,
    ChevronUpIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline'

/**
 * Video status types
 */
type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error' | 'archived'

/**
 * Video interface
 */
interface Video {
    id: string
    isPublished?: boolean
    slug?: string
    title: string
    description: string
    thumbnailUrl?: string
    duration: number // in seconds
    fileSize: number // in bytes
    status: VideoStatus
    subscriptionTier: 'beginner' | 'intermediate' | 'advanced'
    categoryId: string
    categoryName: string
    disciplineId: string
    disciplineName: string
    uploadDate: string
    lastModified: string
    viewCount: number
    completionRate: number // percentage
    instructor?: string
    tags: string[]
    streamId?: string
}

/**
 * Sort configuration
 */
interface SortConfig {
    key: keyof Video | null
    direction: 'asc' | 'desc'
}


/**
 * Video table props
 */
interface VideoTableProps {
    /**
     * Video data
     */
    videos: Video[]

    /**
     * Loading state
     */
    loading?: boolean

    /**
     * Available categories for filtering
     */
    categories?: Array<{ id: string; name: string; disciplineId: string }>

    /**
     * Available disciplines for filtering
     */
    disciplines?: Array<{ id: string; name: string }>

    /**
     * Page size for pagination
     */
    pageSize?: number

    /**
     * Selected video IDs (controlled from parent)
     */
    selectedVideos?: Set<string>

    /**
     * Callback when selection changes
     */
    onSelectionChange?: (selectedIds: Set<string>) => void

    /**
     * Video action callbacks
     */
    onEdit?: (video: Video) => void
    onDelete?: (video: Video) => void
    onPreview?: (video: Video) => void
    onDownload?: (video: Video) => void
    onAnalytics?: (video: Video) => void
    onBulkAction?: (action: string, videos: Video[]) => void

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
] as const

/**
 * Video status options
 */
const VIDEO_STATUSES = [
    { value: 'uploading', label: 'Uploading', color: 'info' },
    { value: 'processing', label: 'Processing', color: 'warning' },
    { value: 'ready', label: 'Ready', color: 'success' },
    { value: 'error', label: 'Error', color: 'error' },
    { value: 'archived', label: 'Archived', color: 'secondary' },
] as const

/**
 * Professional Video Table Component
 */
const VideoTable = React.forwardRef<HTMLDivElement, VideoTableProps>(
    ({
        videos,
        loading = false,
        pageSize = 20,
        selectedVideos = new Set(),
        onSelectionChange,
        onEdit,
        onDelete,
        onPreview,
        onDownload,
        onAnalytics,
        onBulkAction,
        className,
        ...props
    }, ref) => {
        // State management
        const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'uploadDate', direction: 'desc' })
        const [currentPage, setCurrentPage] = useState(1)


        /**
         * Format duration
         */
        const formatDuration = useCallback((seconds: number): string => {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            const remainingSeconds = seconds % 60

            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
            }
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
        }, [])

        /**
         * Format file size
         */
        const formatFileSize = useCallback((bytes: number): string => {
            if (bytes === 0) return '0 Bytes'
            const k = 1024
            const sizes = ['Bytes', 'KB', 'MB', 'GB']
            const i = Math.floor(Math.log(bytes) / Math.log(k))
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
        }, [])

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
         * Handle sorting
         */
        const handleSort = useCallback((key: keyof Video) => {
            setSortConfig(prev => ({
                key,
                direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
            }))
        }, [])


        /**
         * Handle video selection
         */
        const handleVideoSelect = useCallback((videoId: string, selected: boolean) => {
            const newSet = new Set(selectedVideos)
            if (selected) {
                newSet.add(videoId)
            } else {
                newSet.delete(videoId)
            }
            onSelectionChange?.(newSet)
        }, [selectedVideos, onSelectionChange])

        /**
         * Handle bulk action
         */
        const handleBulkAction = useCallback((action: string) => {
            const selectedVideoObjects = videos.filter(v => selectedVideos.has(v.id))
            onBulkAction?.(action, selectedVideoObjects)
            onSelectionChange?.(new Set()) // Clear selection after action
        }, [videos, selectedVideos, onBulkAction, onSelectionChange])

        /**
         * Sort videos (filtering is handled by parent component)
         */
        const sortedVideos = useMemo(() => {
            const sorted = [...videos]

            // Apply sorting
            if (sortConfig.key) {
                sorted.sort((a, b) => {
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

            return sorted
        }, [videos, sortConfig])

        /**
         * Handle select all
         */
        const handleSelectAll = (selected: boolean) => {
            if (selected) {
                onSelectionChange?.(new Set(sortedVideos.map(v => v.id)))
            } else {
                onSelectionChange?.(new Set())
            }
        }

        /**
         * Paginated videos
         */
        const paginatedVideos = useMemo(() => {
            const startIndex = (currentPage - 1) * pageSize
            const endIndex = startIndex + pageSize
            return sortedVideos.slice(startIndex, endIndex)
        }, [currentPage, pageSize, sortedVideos])

        /**
         * Pagination info
         */
        const totalPages = Math.ceil(sortedVideos.length / pageSize)

        /**
         * Render sort icon
         */
        const renderSortIcon = (key: keyof Video) => {
            if (sortConfig.key !== key) {
                return <ChevronUpIcon className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            }
            return sortConfig.direction === 'asc'
                ? <ChevronUpIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                : <ChevronDownIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        }

        /**
         * Render video status badge
         */
        const renderStatusBadge = (status: VideoStatus) => {
            const statusConfig = VIDEO_STATUSES.find(s => s.value === status)
            return (
                <Badge variant={(statusConfig?.color || 'secondary') as 'info' | 'warning' | 'success' | 'error' | 'secondary'}>
                    {statusConfig?.label || status}
                </Badge>
            )
        }

        /**
         * Render subscription tier badge
         */
        const renderTierBadge = (tier: string) => {
            const tierConfig = SUBSCRIPTION_TIERS.find(t => t.value === tier)
            return (
                <Badge variant={(tierConfig?.color || 'secondary') as 'info' | 'warning' | 'success' | 'error' | 'secondary'}>
                    {tierConfig?.label || tier}
                </Badge>
            )
        }

        if (loading) {
            return (
                <Card className={cn('p-6', className)}>
                    <TableSkeleton rows={pageSize} columns={7} showHeader />
                </Card>
            )
        }

        if (videos.length === 0) {
            return (
                <Card className={cn('p-0', className)}>
                    <NoVideosEmptyState
                        onUpload={() => {/* Handle upload */ }}
                        onBrowse={() => {/* Handle browse */ }}
                    />
                </Card>
            )
        }

        return (
            <div ref={ref} className={cn('space-y-4', className)} {...props}>
                {/* Results Summary */}
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                        Showing {paginatedVideos.length} of {sortedVideos.length} videos
                    </span>
                    {selectedVideos.size > 0 && (
                        <div className="flex items-center gap-3">
                            <span>{selectedVideos.size} videos selected</span>
                            {onBulkAction && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkAction('publish')}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                                    >
                                        Publish
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkAction('archive')}
                                        className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-900/20"
                                    >
                                        Archive
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkAction('delete')}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Table */}
                <Card className="overflow-x-auto overflow-y-visible bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedVideos.size === paginatedVideos.length && paginatedVideos.length > 0}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-400 dark:focus:ring-blue-400"
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => handleSort('title')}
                                >
                                    <div className="flex items-center gap-2">
                                        Video
                                        {renderSortIcon('title')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center gap-2">
                                        Status
                                        {renderSortIcon('status')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => handleSort('subscriptionTier')}
                                >
                                    <div className="flex items-center gap-2">
                                        Tier
                                        {renderSortIcon('subscriptionTier')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => handleSort('uploadDate')}
                                >
                                    <div className="flex items-center gap-2">
                                        Upload Date
                                        {renderSortIcon('uploadDate')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => handleSort('viewCount')}
                                >
                                    <div className="flex items-center gap-2">
                                        Engagement
                                        {renderSortIcon('viewCount')}
                                    </div>
                                </TableHead>
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedVideos.map((video) => (
                                <TableRow key={video.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedVideos.has(video.id)}
                                            onChange={(e) => handleVideoSelect(video.id, e.target.checked)}
                                            className="rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-400 dark:focus:ring-blue-400"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {/* Thumbnail */}
                                            <div className="relative w-16 h-12 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                                {video.thumbnailUrl ? (
                                                    <Image
                                                        src={video.thumbnailUrl}
                                                        alt={video.title}
                                                        width={64}
                                                        height={48}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <PlayIcon className="h-6 w-6 text-gray-400" />
                                                )}
                                                {/* Duration overlay */}
                                                <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-xs text-white rounded">
                                                    {formatDuration(video.duration)}
                                                </div>
                                            </div>

                                            {/* Video info */}
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                                    {video.title}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                    {video.disciplineName} • {video.categoryName}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                                    {formatFileSize(video.fileSize)}
                                                    {video.instructor && ` • ${video.instructor}`}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {renderStatusBadge(video.status)}
                                    </TableCell>
                                    <TableCell>
                                        {renderTierBadge(video.subscriptionTier)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="text-gray-900 dark:text-white">{formatDate(video.uploadDate)}</div>
                                            <div className="text-gray-500 dark:text-gray-500 text-xs">
                                                Modified {formatDate(video.lastModified)}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="text-gray-900 dark:text-white">{video.viewCount.toLocaleString()} views</div>
                                            <div className="text-gray-500 dark:text-gray-500 text-xs">
                                                {video.completionRate}% completion
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <VideoActionsDropdown
                                            onPreview={onPreview ? () => onPreview(video) : undefined}
                                            onEdit={onEdit ? () => onEdit(video) : undefined}
                                            onAnalytics={onAnalytics ? () => onAnalytics(video) : undefined}
                                            onDownload={onDownload ? () => onDownload(video) : undefined}
                                            onDelete={onDelete ? () => onDelete(video) : undefined}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalItems={sortedVideos.length}
                        onPageChange={setCurrentPage}
                    />
                )}

                {/* Loading Overlay */}
                <LoadingOverlay
                    isVisible={loading}
                    message="Loading videos..."
                />
            </div>
        )
    }
)

VideoTable.displayName = 'VideoTable'

export default VideoTable
export { VideoTable }
export type { VideoTableProps, Video, VideoStatus } 