/**
 * Evolution Combatives - Video Preview Page
 * Preview video content for admin review
 * 
 * @description Video preview interface for content administrators
 * @author Evolution Combatives
 */

'use client'

import React from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../../../../src/hooks/useAuth'
import { Button } from '../../../../../../src/components/ui/button'
import { Card } from '../../../../../../src/components/ui/card'
import { Badge } from '../../../../../../src/components/ui/badge'
import { Spinner } from '../../../../../../src/components/ui/loading'
import { clientContentService } from '../../../../../../src/services/content-client'
import { queryKeys } from '../../../../../../src/lib/query-client'
import type { VideoWithRelations } from 'shared/types/database'

// Icons
import {
    PlayIcon,
    ArrowLeftIcon,
    PencilIcon,
    ChartBarIcon,
    ClockIcon,
    EyeIcon,
    TagIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function VideoPreviewPage() {
    const router = useRouter()
    const params = useParams()
    const videoId = params.id as string
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()

    // Check permissions
    const canManageContent = hasPermission('content.write')
    const canViewAnalytics = hasPermission('analytics.read')

    // Fetch video data
    const videoQuery = useQuery<VideoWithRelations | null>({
        queryKey: queryKeys.videoDetail(videoId),
        queryFn: () => clientContentService.fetchVideoById(videoId),
        enabled: !!user && !!profile?.admin_role && !!videoId,
        refetchInterval: (query) => {
            // Refetch every 5 seconds if video is still processing
            const data = query.state.data as VideoWithRelations | null | undefined
            const isProcessing = data?.processing_status === 'processing' || data?.processing_status === 'uploading'
            if (isProcessing) {
                return 5000
            }
            return false
        },
        staleTime: 1000 * 60 * 2 // 2 minutes for ready videos
    })

    const video = videoQuery.data

    // Auto-sync mutation to check video status with Cloudflare
    const syncVideoMutation = useMutation({
        mutationFn: async () => {
            // Get CSRF token first
            const csrfResponse = await fetch('/api/csrf-token', {
                credentials: 'include'
            })
            const { csrfToken } = await csrfResponse.json()

            const response = await fetch('/api/video-processing/sync-single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ videoId })
            })
            const result = await response.json()
            if (!result.success) {
                throw new Error(result.error)
            }
            return result
        },
        onSuccess: (result) => {
            // Invalidate and refetch video data
            queryClient.invalidateQueries({ queryKey: queryKeys.videoDetail(videoId) })

            // Log status updates for debugging
            if (result.result?.updated) {
                console.info(`Video ${result.result.title} status updated: ${result.result.oldStatus} → ${result.result.newStatus}`)
            }
        },
        onError: (error) => {
            console.error('Video sync failed:', error.message)
        }
    })


    // Auto-trigger sync for processing videos
    React.useEffect(() => {
        if (video?.processing_status === 'processing' || video?.processing_status === 'uploading') {
            // Initial sync after 10 seconds
            const initialTimer = setTimeout(() => {
                syncVideoMutation.mutate()
            }, 10000)

            // Then sync every 30 seconds while processing
            const intervalTimer = setInterval(() => {
                syncVideoMutation.mutate()
            }, 30000)

            return () => {
                clearTimeout(initialTimer)
                clearInterval(intervalTimer)
            }
        }
    }, [video?.processing_status, syncVideoMutation])



    // Format duration
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const remainingSeconds = seconds % 60

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Format date
    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Render status badge
    const renderStatusBadge = (status: string) => {
        const statusConfig = {
            'uploading': { label: 'Uploading', color: 'info' },
            'processing': { label: 'Processing', color: 'warning' },
            'ready': { label: 'Ready', color: 'success' },
            'error': { label: 'Error', color: 'error' },
            'archived': { label: 'Archived', color: 'secondary' }
        }[status] || { label: status, color: 'secondary' }

        return (
            <Badge variant={statusConfig.color as 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info'}>
                {statusConfig.label}
            </Badge>
        )
    }

    // Render tier badge
    const renderTierBadge = (tier: string) => {
        const tierConfig = {
            'none': { label: 'Free Content', color: 'secondary' },
            'tier1': { label: 'Tier 1 ($9)', color: 'info' },
            'tier2': { label: 'Tier 2 ($19)', color: 'warning' },
            'tier3': { label: 'Tier 3 ($49)', color: 'success' },
            // Legacy support for old values
            'beginner': { label: 'Tier 1 ($9)', color: 'info' },
            'intermediate': { label: 'Tier 2 ($19)', color: 'warning' },
            'advanced': { label: 'Tier 3 ($49)', color: 'success' }
        }[tier] || { label: tier, color: 'secondary' }

        return (
            <Badge variant={tierConfig.color as 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info'}>
                {tierConfig.label}
            </Badge>
        )
    }

    if (authLoading || !user || !profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (videoQuery.isLoading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-center h-96">
                        <Spinner size="lg" />
                    </div>
                </div>
            </div>
        )
    }

    if (videoQuery.error || !video) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-6xl mx-auto">
                    <Card className="p-8 text-center">
                        <h1 className="text-2xl font-bold text-foreground mb-4">
                            Video Not Found
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            The video you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
                        </p>
                        <Button onClick={() => router.push('/dashboard/content/videos')}>
                            Back to Videos
                        </Button>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-4">
                    {/* Title and Navigation */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                Video Preview
                            </h1>
                            <p className="text-muted-foreground">
                                Review video details and content
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => router.push('/dashboard/content/videos')}
                                leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
                                className="flex-shrink-0"
                            >
                                Back to Videos
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => videoQuery.refetch()}
                                disabled={videoQuery.isFetching}
                                leftIcon={<ArrowPathIcon className={`h-4 w-4 ${videoQuery.isFetching ? 'animate-spin' : ''}`} />}
                                className="flex-shrink-0"
                            >
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    console.log('Manual sync button clicked')
                                    syncVideoMutation.mutate()
                                }}
                                disabled={syncVideoMutation.isPending}
                                leftIcon={<ArrowPathIcon className={`h-4 w-4 ${syncVideoMutation.isPending ? 'animate-spin' : ''}`} />}
                                className="flex-shrink-0"
                            >
                                {syncVideoMutation.isPending ? 'Syncing...' : 'Sync Status'}
                            </Button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        {canViewAnalytics && (
                            <Button
                                variant="secondary"
                                onClick={() => router.push(`/dashboard/analytics/videos/${video.id}`)}
                                leftIcon={<ChartBarIcon className="h-4 w-4" />}
                                className="flex-shrink-0"
                            >
                                Analytics
                            </Button>
                        )}
                        {canManageContent && (
                            <Button
                                variant="primary"
                                onClick={() => router.push(`/dashboard/content/videos/${video.id}/edit`)}
                                leftIcon={<PencilIcon className="h-4 w-4" />}
                                className="flex-shrink-0"
                            >
                                Edit Video
                            </Button>
                        )}
                    </div>
                </div>

                {/* Video Player and Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Video Player */}
                    <div className="lg:col-span-2">
                        <Card className="p-0 overflow-hidden">
                            <div className="relative aspect-video bg-black">
                                {video?.cloudflare_video_id && video?.processing_status === 'ready' ? (
                                    <iframe
                                        src={`https://iframe.videodelivery.net/${video.cloudflare_video_id}`}
                                        className="w-full h-full"
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowFullScreen
                                    />
                                ) : video?.processing_status === 'processing' || video?.processing_status === 'uploading' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 dark:bg-neutral-800 text-white">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                                        <h3 className="text-lg font-medium mb-2">Processing Video</h3>
                                        <p className="text-sm text-gray-300 text-center max-w-md">
                                            Your video is being processed by Cloudflare Stream. This usually takes a few minutes.
                                        </p>
                                        <div className="mt-4 text-xs text-gray-400">
                                            Status: {video?.processing_status || 'processing'}
                                        </div>
                                    </div>
                                ) : video?.processing_status === 'error' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/20 text-red-300">
                                        <div className="text-red-400 mb-4">
                                            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-medium mb-2">Processing Error</h3>
                                        <p className="text-sm text-center max-w-md">
                                            There was an error processing your video. Please try re-uploading.
                                        </p>
                                    </div>
                                ) : video?.thumbnail_url ? (
                                    <div className="w-full h-full flex items-center justify-center bg-neutral-900 dark:bg-neutral-800">
                                        <Image
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            fill
                                            className="object-contain"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <PlayIcon className="h-16 w-16 text-white opacity-80" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <PlayIcon className="h-16 w-16 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-foreground mb-2">
                                    {video.title}
                                </h2>
                                {video.description && (
                                    <p className="text-muted-foreground leading-relaxed">
                                        {video.description}
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Video Metadata */}
                    <div className="space-y-6">
                        {/* Status & Tier */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                Status
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        Processing Status
                                    </span>
                                    {renderStatusBadge(video.processing_status || 'ready')}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        Subscription Tier
                                    </span>
                                    {renderTierBadge(video.tier_required || 'none')}
                                </div>
                            </div>
                        </Card>

                        {/* Details */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                Details
                            </h3>
                            <div className="space-y-3">
                                {video.duration_seconds && (
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">
                                            Duration: {formatDuration(video.duration_seconds)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <EyeIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        Views: {(video.view_count || 0).toLocaleString()}
                                    </span>
                                </div>
                                {video.tags && video.tags.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <TagIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <div className="flex flex-wrap gap-1">
                                            {video.tags.map((tag, index) => (
                                                <Badge key={index} variant="secondary" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Category & Discipline */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                Classification
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm text-muted-foreground">Category</span>
                                    <p className="font-medium text-foreground">
                                        {(video.category && typeof video.category === 'object' && 'name' in video.category) ? (video.category as { name: string }).name : 'Uncategorized'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Discipline</span>
                                    <p className="font-medium text-foreground">
                                        {(video.category && typeof video.category === 'object' && 'disciplines' in video.category && video.category.disciplines && typeof video.category.disciplines === 'object' && 'name' in video.category.disciplines) ? (video.category.disciplines as { name: string }).name : 'N/A'}
                                    </p>
                                </div>
                                {video.instructor && (
                                    <div>
                                        <span className="text-sm text-muted-foreground">Instructor</span>
                                        <p className="font-medium text-foreground">
                                            {typeof video.instructor === 'object' && 'name' in video.instructor ?
                                                (video.instructor as { name?: string }).name || 'Unknown' : 'Unknown'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Upload Info */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                Upload Information
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm text-muted-foreground">Uploaded</span>
                                    <p className="text-sm font-medium text-foreground">
                                        {formatDate(video.created_at)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted-foreground">Last Modified</span>
                                    <p className="text-sm font-medium text-foreground">
                                        {formatDate(video.updated_at)}
                                    </p>
                                </div>
                                {video.cloudflare_video_id && (
                                    <div>
                                        <span className="text-sm text-muted-foreground">Stream ID</span>
                                        <p className="text-xs font-mono text-foreground bg-muted p-1 rounded">
                                            {video.cloudflare_video_id}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}