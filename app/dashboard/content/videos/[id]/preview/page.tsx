/**
 * Evolution Combatives - Video Preview Page
 * Preview video content for admin review
 * 
 * @description Video preview interface for content administrators
 * @author Evolution Combatives
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
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
    TagIcon
} from '@heroicons/react/24/outline'

export default function VideoPreviewPage() {
    const router = useRouter()
    const params = useParams()
    const videoId = params.id as string
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()

    // Check permissions
    const canManageContent = hasPermission('content.write')
    const canViewAnalytics = hasPermission('analytics.read')

    // Fetch video data
    const videoQuery = useQuery({
        queryKey: queryKeys.videoDetail(videoId),
        queryFn: () => clientContentService.fetchVideoById(videoId),
        enabled: !!user && !!profile?.admin_role && !!videoId
    })

    const video = videoQuery.data as VideoWithRelations | undefined


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
            <Badge variant={statusConfig.color as any}>
                {statusConfig.label}
            </Badge>
        )
    }

    // Render tier badge
    const renderTierBadge = (tier: string) => {
        const tierConfig = {
            'beginner': { label: 'Beginner', color: 'info' },
            'intermediate': { label: 'Intermediate', color: 'warning' },
            'advanced': { label: 'Advanced', color: 'success' }
        }[tier] || { label: tier, color: 'secondary' }

        return (
            <Badge variant={tierConfig.color as any}>
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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
                <div className="max-w-6xl mx-auto">
                    <Card className="p-8 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Video Not Found
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            The video you're looking for doesn't exist or you don't have permission to view it.
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => router.push('/dashboard/content/videos')}
                            leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
                        >
                            Back to Videos
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Video Preview
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Review video details and content
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {canViewAnalytics && (
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/dashboard/analytics/videos/${video.id}`)}
                                leftIcon={<ChartBarIcon className="h-4 w-4" />}
                            >
                                Analytics
                            </Button>
                        )}
                        {canManageContent && (
                            <Button
                                variant="primary"
                                onClick={() => router.push(`/dashboard/content/videos/${video.id}/edit`)}
                                leftIcon={<PencilIcon className="h-4 w-4" />}
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
                                {video?.cloudflare_video_id ? (
                                    <iframe
                                        src={`https://iframe.videodelivery.net/${video.cloudflare_video_id}`}
                                        className="w-full h-full"
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowFullScreen
                                    />
                                ) : video?.thumbnail_url ? (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                        <img
                                            src={video.thumbnail_url}
                                            alt={video.title}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <PlayIcon className="h-16 w-16 text-white opacity-80" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <PlayIcon className="h-16 w-16 text-gray-400" />
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                    {video.title}
                                </h2>
                                {video.description && (
                                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
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
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Status
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Processing Status
                                    </span>
                                    {renderStatusBadge(video.processing_status || 'ready')}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Subscription Tier
                                    </span>
                                    {renderTierBadge(video.tier_required || 'beginner')}
                                </div>
                            </div>
                        </Card>

                        {/* Details */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Details
                            </h3>
                            <div className="space-y-3">
                                {video.duration_seconds && (
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            Duration: {formatDuration(video.duration_seconds)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <EyeIcon className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Views: {(video.view_count || 0).toLocaleString()}
                                    </span>
                                </div>
                                {video.tags && video.tags.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <TagIcon className="h-4 w-4 text-gray-400 mt-0.5" />
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
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Classification
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Category</span>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {typeof video.category === 'object' && video.category ? video.category.name : 'Uncategorized'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Discipline</span>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {typeof video.category === 'object' && video.category && 
                                         typeof video.category.discipline === 'object' && video.category.discipline ? 
                                         video.category.discipline.name : 'N/A'}
                                    </p>
                                </div>
                                {video.instructor && (
                                    <div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Instructor</span>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {typeof video.instructor === 'object' && 'name' in video.instructor ? 
                                             (video.instructor as { name?: string }).name || 'Unknown' : 'Unknown'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Upload Info */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Upload Information
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Uploaded</span>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(video.created_at)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Last Modified</span>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(video.updated_at)}
                                    </p>
                                </div>
                                {video.cloudflare_video_id && (
                                    <div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Stream ID</span>
                                        <p className="text-xs font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 p-1 rounded">
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