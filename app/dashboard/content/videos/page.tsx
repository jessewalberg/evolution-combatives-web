/**
 * Evolution Combatives - Video Library Management
 * Comprehensive video content management for admin dashboard
 * 
 * @description Video library with advanced filtering, bulk operations, and analytics
 * @author Evolution Combatives
 */

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '../../../../src/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../../src/hooks/useAuth'
import { StatsCard, StatsCardGrid } from '../../../../src/components/ui/stats-card'
import { Card } from '../../../../src/components/ui/card'
import { Button } from '../../../../src/components/ui/button'
import { Input } from '../../../../src/components/ui/input'

import { Spinner } from '../../../../src/components/ui/loading'
import { VideoTable } from '../../../../src/components/video/video-table'
import { clientContentService } from '../../../../src/services/content-client'
import { queryKeys } from '../../../../src/lib/query-client'
import type {
    ContentFilters,
    PaginationOptions
} from '../../../../src/services/content'
import type {
    VideoWithRelations,
    CategoryWithRelations,
    DisciplineWithRelations,
    ProcessingStatus,
    SubscriptionTier
} from 'shared/types/database'

// Icons
import {
    MagnifyingGlassIcon,
    PlusIcon,
    DocumentArrowDownIcon,
    CheckIcon,
    TrashIcon,
    VideoCameraIcon,
    EyeIcon,
    ClockIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface VideoFilters {
    search: string
    category: string[]
    discipline: string[]
    status: string[]
    tier: string[]
    dateRange: {
        start?: string
        end?: string
    }
}

interface BulkAction {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    action: (videoIds: string[]) => void
    variant?: 'destructive' | 'primary' | 'secondary' | 'success' | 'warning' | 'outline' | 'ghost'
    requiresConfirmation?: boolean
}

export default function VideoLibraryPage() {
    const router = useRouter()
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()

    // State
    const [filters, setFilters] = useState<VideoFilters>({
        search: '',
        category: [],
        discipline: [],
        status: [],
        tier: [],
        dateRange: {}
    })
    const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    // Pagination state
    const [pagination] = useState<PaginationOptions>({
        page: 1,
        pageSize: 20,
        orderBy: 'created_at',
        orderDirection: 'desc'
    })

    // Convert filters to ContentFilters format
    const contentFilters: ContentFilters = useMemo(() => ({
        search: filters.search || undefined,
        categoryId: filters.category.length > 0 ? filters.category[0] : undefined,
        disciplineId: filters.discipline.length > 0 ? filters.discipline[0] : undefined,
        processingStatus: filters.status.length > 0 ? filters.status[0] as ProcessingStatus : undefined,
        subscriptionTier: filters.tier.length > 0 ? filters.tier[0] as SubscriptionTier : undefined,
    }), [filters])

    // Check permissions
    const canManageContent = hasPermission('content.write')
    const canDeleteContent = hasPermission('content.delete')
    const canViewAnalytics = hasPermission('analytics.read')

    // Queries
    const videosQuery = useQuery({
        queryKey: queryKeys.videosList(contentFilters, pagination),
        queryFn: () => clientContentService.fetchVideos(contentFilters, pagination),
        enabled: !!user && !!profile?.admin_role
    })

    const categoriesQuery = useQuery({
        queryKey: queryKeys.categoriesList(),
        queryFn: () => clientContentService.fetchCategories(),
        enabled: !!user && !!profile?.admin_role
    })

    const disciplinesQuery = useQuery({
        queryKey: queryKeys.disciplinesList(),
        queryFn: () => clientContentService.fetchDisciplines(),
        enabled: !!user && !!profile?.admin_role
    })

    // Mutations
    const deleteVideoMutation = useMutation({
        mutationFn: (videoId: string) => clientContentService.deleteVideo(videoId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
            toast.success('Video deleted successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to delete video', {
                description: error.message
            })
        }
    })

    const bulkUpdateMutation = useMutation({
        mutationFn: ({ videoIds, status }: { videoIds: string[]; status: 'uploading' | 'processing' | 'ready' | 'error' }) =>
            clientContentService.bulkUpdateVideoStatus(videoIds, { processing_status: status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
            setSelectedVideos(new Set())
            setBulkActionLoading(false)
            toast.success('Videos updated successfully')
        },
        onError: (error: Error) => {
            setBulkActionLoading(false)
            toast.error('Failed to update videos', {
                description: error.message
            })
        }
    })

    const bulkDeleteMutation = useMutation({
        mutationFn: (videoIds: string[]) => clientContentService.bulkDeleteVideos(videoIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
            setSelectedVideos(new Set())
            setBulkActionLoading(false)
            toast.success('Videos deleted successfully')
        },
        onError: (error: Error) => {
            setBulkActionLoading(false)
            toast.error('Failed to delete videos', {
                description: error.message
            })
        }
    })

    const syncProcessingMutation = useMutation({
        mutationFn: async () => {
            // Get CSRF token first
            const csrfResponse = await fetch('/api/csrf-token', {
                credentials: 'include'
            })
            const { csrfToken } = await csrfResponse.json()

            const response = await fetch('/api/video-processing/sync-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include'
            })
            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error)
            }
            return result
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })

            if (result.results.errors > 0) {
                console.log('Sync errors:', result.results.details.filter((d: { error?: string }) => d.error))
                toast.warning(`Sync completed with errors: ${result.results.updated} videos updated`, {
                    description: `Checked ${result.results.checked} videos, ${result.results.errors} errors. Check console for details.`
                })
            } else {
                toast.success(`Sync completed: ${result.results.updated} videos updated`, {
                    description: `Checked ${result.results.checked} videos successfully`
                })
            }
        },
        onError: (error: Error) => {
            toast.error('Failed to sync video processing status', {
                description: error.message
            })
        }
    })

    // Get videos data safely - debug the structure
    const videosData = useMemo(() => {
        console.log('Raw videosQuery.data:', videosQuery.data)
        const data = videosQuery.data?.data || []
        console.log('Processed videosData:', data)
        return data
    }, [videosQuery.data])

    const totalVideos = useMemo(() => {
        const count = videosQuery.data?.totalCount || videosData.length || 0
        console.log('Total videos count:', count)
        return count
    }, [videosQuery.data?.totalCount, videosData.length])

    // Filter videos based on current filters
    const filteredVideos: VideoWithRelations[] = useMemo(() => {
        return videosData.filter((video: VideoWithRelations) => {
            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                const matchesSearch =
                    video.title.toLowerCase().includes(searchLower) ||
                    (video.description && video.description.toLowerCase().includes(searchLower))

                if (!matchesSearch) return false
            }

            // Category filter
            if (filters.category.length > 0 && !filters.category.includes(video.category_id)) {
                return false
            }

            // Discipline filter
            if (filters.discipline.length > 0) {
                const videoDisciplineId = video.category?.discipline_id || ''

                if (!videoDisciplineId || !filters.discipline.includes(videoDisciplineId)) {
                    return false
                }
            }

            // Status filter - using processing_status instead of status
            if (filters.status.length > 0 && !filters.status.includes(video.processing_status || '')) {
                return false
            }

            // Tier filter
            if (filters.tier.length > 0 && !filters.tier.includes(video.tier_required || '')) {
                return false
            }

            // Date range filter
            if (filters.dateRange.start || filters.dateRange.end) {
                const videoDate = new Date(video.created_at)
                if (filters.dateRange.start && videoDate < new Date(filters.dateRange.start)) {
                    return false
                }
                if (filters.dateRange.end && videoDate > new Date(filters.dateRange.end)) {
                    return false
                }
            }

            return true
        })
    }, [videosData, filters])

    // Bulk actions configuration
    const bulkActions: BulkAction[] = [
        {
            id: 'publish',
            label: 'Publish Selected',
            icon: CheckIcon,
            action: (videoIds) => {
                setBulkActionLoading(true)
                bulkUpdateMutation.mutate({ videoIds, status: 'ready' })
            }
        },
        {
            id: 'archive',
            label: 'Archive Selected',
            icon: DocumentArrowDownIcon,
            action: (videoIds) => {
                setBulkActionLoading(true)
                bulkUpdateMutation.mutate({ videoIds, status: 'error' }) // Using 'error' as closest to archived
            }
        },
        {
            id: 'delete',
            label: 'Delete Selected',
            icon: TrashIcon,
            variant: 'destructive' as const,
            requiresConfirmation: true,
            action: (videoIds) => {
                if (confirm(`Are you sure you want to delete ${videoIds.length} videos? This action cannot be undone.`)) {
                    setBulkActionLoading(true)
                    bulkDeleteMutation.mutate(videoIds)
                }
            }
        }
    ]

    // Handle video actions
    const handleVideoEdit = (video: VideoWithRelations) => {
        router.push(`/dashboard/content/videos/${video.id}/edit`)
    }

    const handleVideoPreview = (video: VideoWithRelations) => {
        // Open video preview modal or new tab
        window.open(`/dashboard/content/videos/${video.id}/preview`, '_blank')
    }

    const handleVideoDelete = (video: VideoWithRelations) => {
        if (confirm(`Are you sure you want to delete "${video.title}"? This action cannot be undone.`)) {
            deleteVideoMutation.mutate(video.id)
        }
    }

    const handleVideoAnalytics = (video: VideoWithRelations) => {
        // Analytics coming soon
        toast.info('Analytics coming soon', {
            description: `Video analytics for "${video.title}" is under development.`
        })
    }

    const handleVideoDownload = (video: VideoWithRelations) => {
        // Implement video download logic
        toast.info('Download started', {
            description: `Downloading ${video.title}...`
        })
    }

    // Handle bulk actions
    const handleBulkAction = (action: BulkAction) => {
        const videoIds = Array.from(selectedVideos)
        if (videoIds.length === 0) {
            toast.error('No videos selected')
            return
        }

        action.action(videoIds)
    }

    // Clear filters
    const clearFilters = () => {
        setFilters({
            search: '',
            category: [],
            discipline: [],
            status: [],
            tier: [],
            dateRange: {}
        })
    }

    // Export videos data
    const handleExport = () => {
        const csvData = filteredVideos.map((video: VideoWithRelations) => {
            const category = (categoriesQuery.data as CategoryWithRelations[] || []).find(cat => cat.id === video.category_id)
            return {
                title: video.title,
                category: category?.name || '',
                instructor: '', // Instructor data not available in current schema
                status: video.processing_status,
                tier: video.tier_required,
                uploadDate: video.created_at,
                viewCount: video.view_count || 0
            }
        })

        const headers = ['Title', 'Category', 'Instructor', 'Status', 'Tier', 'Upload Date', 'Views']
        const csvContent = [
            headers.join(','),
            ...csvData.map((row) => headers.map(header => {
                const key = header.toLowerCase().replace(' ', '') as keyof typeof row
                return `"${row[key]}"`
            }).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'video-library.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    if (authLoading || !user || !profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Page Header */}
                <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border">
                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                                    Video Library
                                </h1>
                                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                                    Manage training videos, organize by categories, and track performance
                                </p>
                            </div>
                            {canManageContent && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={() => syncProcessingMutation.mutate()}
                                        disabled={syncProcessingMutation.isPending}
                                        leftIcon={<ArrowPathIcon className={cn("h-4 w-4", syncProcessingMutation.isPending && "animate-spin")} />}
                                        className="w-full sm:w-auto"
                                    >
                                        <span className="sm:inline">Sync Status</span>
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="default"
                                        onClick={() => router.push('/dashboard/content/videos/upload')}
                                        leftIcon={<PlusIcon className="h-4 w-4" />}
                                        className="w-full sm:w-auto"
                                    >
                                        <span className="sm:inline">Upload Video</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="bg-card text-card-foreground rounded-lg p-6 shadow-sm border border-border">
                    <h2 className="text-xl font-semibold text-foreground mb-4">
                        Library Overview
                    </h2>
                    <StatsCardGrid columns={4}>
                        <StatsCard
                            title="Total Videos"
                            value={totalVideos}
                            metricType="count"
                            icon={VideoCameraIcon}
                            variant="metric"
                            isLoading={videosQuery.isLoading}
                        />
                        <StatsCard
                            title="Published"
                            value={videosData.filter((v: VideoWithRelations) => v.processing_status === 'ready').length}
                            metricType="count"
                            subtitle="Ready to view"
                            icon={CheckIcon}
                            variant="growth"
                            isLoading={videosQuery.isLoading}
                        />
                        <StatsCard
                            title="Processing"
                            value={videosData.filter((v: VideoWithRelations) => v.processing_status === 'processing').length}
                            metricType="count"
                            subtitle="Being processed"
                            icon={ClockIcon}
                            variant="engagement"
                            isLoading={videosQuery.isLoading}
                        />
                        <StatsCard
                            title="Total Views"
                            value={videosData.reduce((sum: number, v: VideoWithRelations) => sum + (v.view_count || 0), 0)}
                            metricType="count"
                            icon={EyeIcon}
                            variant="metric"
                            isLoading={videosQuery.isLoading}
                        />
                    </StatsCardGrid>
                </div>

                {/* Search and Filters */}
                <Card className="shadow-sm">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-card-foreground">
                                Search & Filter
                            </h3>
                            <Button variant="outline" onClick={clearFilters}>
                                Clear All
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search videos..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="pl-10"
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={filters.category[0] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        category: e.target.value ? [e.target.value] : []
                                    }))}
                                    className="h-10 w-full px-3 py-2 pr-8 bg-background border border-input rounded-md text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                    <option value="">All Categories</option>
                                    {categoriesQuery.isLoading && <option disabled>Loading...</option>}
                                    {categoriesQuery.error && <option disabled>Error loading categories</option>}
                                    {(categoriesQuery.data as CategoryWithRelations[] || []).map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={filters.discipline[0] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        discipline: e.target.value ? [e.target.value] : []
                                    }))}
                                    className="h-10 w-full px-3 py-2 pr-8 bg-background border border-input rounded-md text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                    <option value="">All Disciplines</option>
                                    {disciplinesQuery.isLoading && <option disabled>Loading...</option>}
                                    {disciplinesQuery.error && <option disabled>Error loading disciplines</option>}
                                    {(disciplinesQuery.data as DisciplineWithRelations[] || []).map(discipline => (
                                        <option key={discipline.id} value={discipline.id}>
                                            {discipline.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={filters.status[0] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        status: e.target.value ? [e.target.value] : []
                                    }))}
                                    className="h-10 w-full px-3 py-2 pr-8 bg-background border border-input rounded-md text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                    <option value="">All Status</option>
                                    <option value="uploading">Uploading</option>
                                    <option value="processing">Processing</option>
                                    <option value="ready">Ready</option>
                                    <option value="error">Error</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={filters.tier[0] || ''}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        tier: e.target.value ? [e.target.value] : []
                                    }))}
                                    className="h-10 w-full px-3 py-2 pr-8 bg-background border border-input rounded-md text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                    <option value="">All Tiers</option>
                                    <option value="none">Free Content</option>
                                    <option value="tier1">Tier 1 ($9)</option>
                                    <option value="tier2">Tier 2 ($19)</option>
                                    <option value="tier3">Tier 3 ($49)</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="default"
                                onClick={handleExport}
                                leftIcon={<DocumentArrowDownIcon className="h-4 w-4" />}
                                className="h-10"
                            >
                                Export
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Bulk Actions Toolbar */}
                {selectedVideos.size > 0 && (
                    <Card className="bg-primary/10 border-primary/20">
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-primary">
                                        {selectedVideos.size} video{selectedVideos.size === 1 ? '' : 's'} selected
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedVideos(new Set())}
                                        className="text-primary border-primary/30 hover:bg-primary/10"
                                    >
                                        Clear Selection
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {bulkActions.map((action) => (
                                        <Button
                                            key={action.id}
                                            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                                            size="sm"
                                            onClick={() => handleBulkAction(action)}
                                            disabled={bulkActionLoading}
                                            leftIcon={<action.icon className="h-4 w-4" />}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Video Table */}
                <VideoTable
                    videos={filteredVideos.map(video => ({
                        id: video.id,
                        title: video.title,
                        description: video.description || '',
                        thumbnailUrl: video.thumbnail_url || undefined,
                        duration: video.duration_seconds || 0,
                        fileSize: 0, // File size not available in current schema
                        status: (video.processing_status || 'ready') as 'uploading' | 'processing' | 'ready' | 'error' | 'archived',
                        subscriptionTier: (video.tier_required || 'none') as 'none' | 'tier1' | 'tier2' | 'tier3',
                        categoryId: video.category_id,
                        disciplineId: video.category?.discipline_id || '',
                        categoryName: video.category?.name || 'Uncategorized',
                        disciplineName: video.category?.discipline?.name || 'N/A',
                        instructor: video.instructor?.full_name || '',
                        uploadDate: video.created_at,
                        lastModified: video.updated_at,
                        viewCount: video.view_count || 0,
                        completionRate: 0, // This would need to be calculated from user_progress
                        tags: video.tags || [],
                        streamId: video.cloudflare_video_id || undefined
                    }))}
                    selectedVideos={selectedVideos}
                    onSelectionChange={setSelectedVideos}
                    categories={(categoriesQuery.data as CategoryWithRelations[] || []).map(cat => ({
                        id: cat.id,
                        name: cat.name,
                        disciplineId: cat.discipline_id
                    }))}
                    disciplines={(disciplinesQuery.data as DisciplineWithRelations[] || []).map(disc => ({
                        id: disc.id,
                        name: disc.name
                    }))}
                    loading={videosQuery.isLoading}
                    onEdit={(video) => {
                        const originalVideo = filteredVideos.find(v => v.id === video.id)
                        if (originalVideo) handleVideoEdit(originalVideo)
                    }}
                    onPreview={(video) => {
                        const originalVideo = filteredVideos.find(v => v.id === video.id)
                        if (originalVideo) handleVideoPreview(originalVideo)
                    }}
                    onDelete={canDeleteContent ? (video) => {
                        const originalVideo = filteredVideos.find(v => v.id === video.id)
                        if (originalVideo) handleVideoDelete(originalVideo)
                    } : undefined}
                    onAnalytics={canViewAnalytics ? (video) => {
                        const originalVideo = filteredVideos.find(v => v.id === video.id)
                        if (originalVideo) handleVideoAnalytics(originalVideo)
                    } : undefined}
                    onDownload={(video) => {
                        const originalVideo = filteredVideos.find(v => v.id === video.id)
                        if (originalVideo) handleVideoDownload(originalVideo)
                    }}
                    onBulkAction={(action, videos) => {
                        if (action === 'publish') {
                            setBulkActionLoading(true)
                            bulkUpdateMutation.mutate({ videoIds: videos.map(v => v.id), status: 'ready' })
                        } else if (action === 'archive') {
                            setBulkActionLoading(true)
                            bulkUpdateMutation.mutate({ videoIds: videos.map(v => v.id), status: 'error' })
                        } else if (action === 'delete') {
                            if (confirm(`Are you sure you want to delete ${videos.length} videos? This action cannot be undone.`)) {
                                setBulkActionLoading(true)
                                bulkDeleteMutation.mutate(videos.map(v => v.id))
                            }
                        }
                    }}
                />
            </div>
        </div>
    )
} 