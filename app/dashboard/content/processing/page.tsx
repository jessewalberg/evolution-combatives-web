/**
 * Evolution Combatives - Video Processing Monitor
 * Real-time video processing status and queue management
 * Designed for tactical training content administrators
 * 
 * @description Comprehensive processing monitoring with real-time updates and manual intervention
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// UI Components
import { Button } from '../../../../src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../src/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../src/components/ui/table'
import { Badge } from '../../../../src/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../src/components/ui/dialog'

// Icons
import {
    PlayIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    EyeIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline'

// Services & Types
import { cloudflareApi } from '../../../../src/lib/cloudflare-api'
import { createClientComponentClient } from '../../../../src/lib/supabase-browser'
import { useAuth } from '../../../../src/hooks/useAuth'
import { VideoWithRelations, ProcessingStatus } from 'shared/types/database'

// Processing Status Types
interface ProcessingJob {
    id: string
    video: VideoWithRelations
    status: ProcessingStatus
    progress: number
    startedAt: string
    estimatedCompletion?: string
    error?: {
        code?: string
        message: string
        details?: any
    }
    retryCount: number
    lastRetryAt?: string
    processingLogs: ProcessingLog[]
}

interface ProcessingLog {
    id: string
    videoId: string
    timestamp: string
    level: 'info' | 'warning' | 'error'
    message: string
    details?: any
}

interface ProcessingStats {
    totalJobs: number
    processingJobs: number
    completedJobs: number
    failedJobs: number
    averageProcessingTime: number
    queueLength: number
    systemLoad: number
}

// Removed unused interface ProcessingMetrics

// Loading Spinner Component
function LoadingSpinner({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8'
    }

    return (
        <div className="animate-spin">
            <svg
                className={sizeClasses[size]}
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>
    )
}

// Status Badge Component
function StatusBadge({ status, progress }: { status: ProcessingStatus; progress?: number }) {
    const statusConfig = {
        uploading: { variant: 'warning' as const, icon: ArrowPathIcon, label: 'Uploading' },
        processing: { variant: 'info' as const, icon: Cog6ToothIcon, label: 'Processing' },
        ready: { variant: 'success' as const, icon: CheckCircleIcon, label: 'Ready' },
        error: { variant: 'error' as const, icon: ExclamationTriangleIcon, label: 'Error' }
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
            {status === 'processing' && progress !== undefined && (
                <div className="flex items-center gap-2">
                    <div className="w-16 bg-neutral-700 rounded-full h-2">
                        <div
                            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-xs text-neutral-400">{progress}%</span>
                </div>
            )}
        </div>
    )
}

// Processing Job Row Component
function ProcessingJobRow({
    job,
    onRetry,
    onCancel,
    onViewLogs,
    onViewDetails
}: {
    job: ProcessingJob
    onRetry: (job: ProcessingJob) => void
    onCancel: (job: ProcessingJob) => void
    onViewLogs: (job: ProcessingJob) => void
    onViewDetails: (job: ProcessingJob) => void
}) {
    const estimatedTime = job.estimatedCompletion
        ? new Date(job.estimatedCompletion).toLocaleTimeString()
        : 'Unknown'

    const processingTime = job.startedAt
        ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000 / 60)
        : 0

    return (
        <TableRow className="hover:bg-neutral-800/50">
            <TableCell>
                <div className="flex items-center gap-3">
                    <div className="w-16 h-12 bg-neutral-700 rounded overflow-hidden">
                        {job.video.thumbnail_url ? (
                            <img
                                src={job.video.thumbnail_url}
                                alt={job.video.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <PlayIcon className="h-6 w-6 text-neutral-400" />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="font-medium text-neutral-0">{job.video.title}</div>
                        <div className="text-sm text-neutral-400">
                            {job.video.category?.name} • {job.video.instructor?.full_name}
                        </div>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <StatusBadge status={job.status} progress={job.progress} />
            </TableCell>
            <TableCell>
                <div className="text-sm text-neutral-300">
                    {processingTime > 0 ? `${processingTime}m` : 'Just started'}
                </div>
            </TableCell>
            <TableCell>
                <div className="text-sm text-neutral-300">
                    {job.status === 'processing' ? estimatedTime : '-'}
                </div>
            </TableCell>
            <TableCell>
                <div className="text-sm text-neutral-300">
                    {job.retryCount > 0 ? `${job.retryCount} attempts` : 'First attempt'}
                </div>
            </TableCell>
            <TableCell>
                {job.error && (
                    <div className="text-sm text-error-400 max-w-xs truncate">
                        {job.error.message}
                    </div>
                )}
            </TableCell>
            <TableCell align="right">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(job)}
                        className="h-8 w-8 p-0"
                    >
                        <EyeIcon className="h-4 w-4" />
                        <span className="sr-only">View details</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewLogs(job)}
                        className="h-8 w-8 p-0"
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                        <span className="sr-only">View logs</span>
                    </Button>
                    {(job.status === 'error' || job.status === 'uploading') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRetry(job)}
                            className="h-8 w-8 p-0 text-warning-400 hover:text-warning-300"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            <span className="sr-only">Retry processing</span>
                        </Button>
                    )}
                    {job.status === 'processing' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancel(job)}
                            className="h-8 w-8 p-0 text-error-400 hover:text-error-300"
                        >
                            <XMarkIcon className="h-4 w-4" />
                            <span className="sr-only">Cancel processing</span>
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
}

export default function ProcessingPage() {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()
    const supabase = createClientComponentClient()

    // State
    const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null)
    const [logsDialogOpen, setLogsDialogOpen] = useState(false)
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [refreshInterval, setRefreshInterval] = useState(5000) // 5 seconds

    // Check permissions
    const canManageProcessing = profile?.admin_role === 'super_admin' || profile?.admin_role === 'content_admin'

    // Fetch processing jobs
    const processingJobsQuery = useQuery({
        queryKey: ['processing-jobs'],
        queryFn: async (): Promise<ProcessingJob[]> => {
            const { data: videos, error } = await supabase
                .from('videos')
                .select(`
                    *,
                    category(
                        *,
                        discipline(*)
                    ),
                    instructor(*),
                    processing_logs(*)
                `)
                .in('processing_status', ['uploading', 'processing', 'error'])
                .order('created_at', { ascending: false })

            if (error) throw error

            // Transform to ProcessingJob format
            return videos?.map(video => ({
                id: video.id,
                video: video as VideoWithRelations,
                status: video.processing_status as ProcessingStatus,
                progress: video.processing_progress || 0,
                startedAt: video.processing_started_at || video.created_at,
                estimatedCompletion: video.estimated_completion_at,
                error: video.error_code ? {
                    code: video.error_code,
                    message: video.error_message || 'Unknown error',
                    details: video.error_details
                } : undefined,
                retryCount: video.retry_count || 0,
                lastRetryAt: video.last_retry_at,
                processingLogs: video.processing_logs || []
            })) || []
        },
        enabled: !!user && !!profile?.admin_role,
        refetchInterval: autoRefresh ? refreshInterval : false,
    })

    // Fetch processing statistics
    const processingStatsQuery = useQuery({
        queryKey: ['processing-stats'],
        queryFn: async (): Promise<ProcessingStats> => {
            const [totalResult, processingResult, completedResult, failedResult] = await Promise.all([
                supabase.from('videos').select('id', { count: 'exact', head: true }),
                supabase.from('videos').select('id', { count: 'exact', head: true }).eq('processing_status', 'processing'),
                supabase.from('videos').select('id', { count: 'exact', head: true }).eq('processing_status', 'ready'),
                supabase.from('videos').select('id', { count: 'exact', head: true }).eq('processing_status', 'error'),
            ])

            // Calculate average processing time from completed videos
            const { data: completedVideos } = await supabase
                .from('videos')
                .select('processing_started_at, processing_completed_at')
                .eq('processing_status', 'ready')
                .not('processing_started_at', 'is', null)
                .not('processing_completed_at', 'is', null)
                .limit(100)

            const averageProcessingTime = (completedVideos || []).reduce((sum, video) => {
                const start = new Date(video.processing_started_at!).getTime()
                const end = new Date(video.processing_completed_at!).getTime()
                return sum + (end - start)
            }, 0) / (completedVideos?.length || 1) / 1000 / 60 // Convert to minutes

            return {
                totalJobs: totalResult.count || 0,
                processingJobs: processingResult.count || 0,
                completedJobs: completedResult.count || 0,
                failedJobs: failedResult.count || 0,
                averageProcessingTime: Math.round(averageProcessingTime || 0),
                queueLength: processingResult.count || 0,
                systemLoad: Math.random() * 100 // Mock system load - replace with real metrics
            }
        },
        enabled: !!user && !!profile?.admin_role,
        refetchInterval: autoRefresh ? refreshInterval * 2 : false,
    })

    // Real-time subscription for processing updates
    useEffect(() => {
        if (!user || !profile?.admin_role) return

        const channel = supabase
            .channel('processing-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'videos',
                    filter: 'processing_status=in.(uploading,processing,error)'
                },
                (payload) => {
                    console.log('Processing update received:', payload)
                    queryClient.invalidateQueries({ queryKey: ['processing-jobs'] })
                    queryClient.invalidateQueries({ queryKey: ['processing-stats'] })

                    // Show toast for status changes
                    if (payload.eventType === 'UPDATE') {
                        const video = payload.new as any
                        if (video.processing_status === 'ready') {
                            toast.success(`Video "${video.title}" processing completed`)
                        } else if (video.processing_status === 'error') {
                            toast.error(`Video "${video.title}" processing failed`)
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, profile, queryClient, supabase])

    // Mutations
    const retryProcessingMutation = useMutation({
        mutationFn: async (job: ProcessingJob) => {
            // Call Cloudflare Stream API to retry processing
            await cloudflareApi.retryProcessing(job.video.cloudflare_video_id!)

            // Update database
            const { error } = await supabase
                .from('videos')
                .update({
                    processing_status: 'processing',
                    retry_count: (job.retryCount || 0) + 1,
                    last_retry_at: new Date().toISOString(),
                    error_code: null,
                    error_message: null
                })
                .eq('id', job.id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processing-jobs'] })
            toast.success('Processing retry initiated')
        },
        onError: (error: any) => {
            toast.error(`Failed to retry processing: ${error.message}`)
        },
    })

    const cancelProcessingMutation = useMutation({
        mutationFn: async (job: ProcessingJob) => {
            // Update database to mark as cancelled
            const { error } = await supabase
                .from('videos')
                .update({
                    processing_status: 'error',
                    error_code: 'CANCELLED',
                    error_message: 'Processing cancelled by administrator'
                })
                .eq('id', job.id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processing-jobs'] })
            toast.success('Processing cancelled')
        },
        onError: (error: any) => {
            toast.error(`Failed to cancel processing: ${error.message}`)
        },
    })

    // Handlers
    const handleRetry = (job: ProcessingJob) => {
        if (!canManageProcessing) {
            toast.error('You do not have permission to retry processing')
            return
        }
        retryProcessingMutation.mutate(job)
    }

    const handleCancel = (job: ProcessingJob) => {
        if (!canManageProcessing) {
            toast.error('You do not have permission to cancel processing')
            return
        }
        cancelProcessingMutation.mutate(job)
    }

    const handleViewLogs = (job: ProcessingJob) => {
        setSelectedJob(job)
        setLogsDialogOpen(true)
    }

    const handleViewDetails = (job: ProcessingJob) => {
        setSelectedJob(job)
        setDetailsDialogOpen(true)
    }

    // Memoized data
    const processingJobs = processingJobsQuery.data || []
    const stats = processingStatsQuery.data || {
        totalJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        queueLength: 0,
        systemLoad: 0
    }

    const queuedJobs = processingJobs.filter(job => job.status === 'uploading')
    const activeJobs = processingJobs.filter(job => job.status === 'processing')
    const failedJobs = processingJobs.filter(job => job.status === 'error')

    // Loading state
    if (processingJobsQuery.isLoading || processingStatsQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-0">Video Processing Monitor</h1>
                    <p className="text-neutral-400">
                        Real-time monitoring and management of video processing jobs
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-neutral-300">Auto-refresh:</label>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-primary-600"
                        />
                    </div>
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        disabled={!autoRefresh}
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 disabled:opacity-50"
                    >
                        <option value={5000}>5 seconds</option>
                        <option value={10000}>10 seconds</option>
                        <option value={30000}>30 seconds</option>
                        <option value={60000}>1 minute</option>
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-info-500/10 rounded-lg">
                                <ChartBarIcon className="h-6 w-6 text-info-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {stats.queueLength}
                                </p>
                                <p className="text-sm text-neutral-400">Queue Length</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-warning-500/10 rounded-lg">
                                <Cog6ToothIcon className="h-6 w-6 text-warning-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {stats.processingJobs}
                                </p>
                                <p className="text-sm text-neutral-400">Processing</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-success-500/10 rounded-lg">
                                <CheckCircleIcon className="h-6 w-6 text-success-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {stats.completedJobs}
                                </p>
                                <p className="text-sm text-neutral-400">Completed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-error-500/10 rounded-lg">
                                <ExclamationTriangleIcon className="h-6 w-6 text-error-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {stats.failedJobs}
                                </p>
                                <p className="text-sm text-neutral-400">Failed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>System Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-neutral-300">System Load</span>
                                    <span className="text-neutral-0">{Math.round(stats.systemLoad)}%</span>
                                </div>
                                <div className="w-full bg-neutral-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-300 ${stats.systemLoad > 80 ? 'bg-error-500' :
                                            stats.systemLoad > 60 ? 'bg-warning-500' : 'bg-success-500'
                                            }`}
                                        style={{ width: `${stats.systemLoad}%` }}
                                    />
                                </div>
                            </div>
                            <div className="pt-2 border-t border-neutral-700">
                                <p className="text-sm text-neutral-300">
                                    Average Processing Time: <span className="text-neutral-0">{stats.averageProcessingTime}m</span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Queue Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-neutral-300">Queued</span>
                                <Badge variant="warning">{queuedJobs.length}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-neutral-300">Active</span>
                                <Badge variant="info">{activeJobs.length}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-neutral-300">Failed</span>
                                <Badge variant="error">{failedJobs.length}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Processing Jobs Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Processing Jobs
                        {processingJobs.length > 0 && (
                            <Badge variant="secondary">{processingJobs.length} jobs</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {processingJobs.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircleIcon className="mx-auto h-12 w-12 text-success-400" />
                            <h3 className="mt-4 text-lg font-medium text-neutral-0">All Processing Complete</h3>
                            <p className="mt-2 text-sm text-neutral-400">
                                No videos are currently being processed. All jobs have been completed successfully.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Video</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>ETA</TableHead>
                                    <TableHead>Attempts</TableHead>
                                    <TableHead>Error</TableHead>
                                    <TableHead align="right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processingJobs.map((job) => (
                                    <ProcessingJobRow
                                        key={job.id}
                                        job={job}
                                        onRetry={handleRetry}
                                        onCancel={handleCancel}
                                        onViewLogs={handleViewLogs}
                                        onViewDetails={handleViewDetails}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Processing Logs Dialog */}
            <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Processing Logs</DialogTitle>
                        <DialogDescription>
                            Detailed processing logs for &quot;{selectedJob?.video.title}&quot;
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {selectedJob?.processingLogs?.length ? (
                            selectedJob.processingLogs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-md text-sm font-mono ${log.level === 'error' ? 'bg-error-500/10 text-error-300' :
                                        log.level === 'warning' ? 'bg-warning-500/10 text-warning-300' :
                                            'bg-neutral-800 text-neutral-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs opacity-75">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                        <Badge
                                            variant={
                                                log.level === 'error' ? 'error' :
                                                    log.level === 'warning' ? 'warning' : 'secondary'
                                            }
                                            className="text-xs"
                                        >
                                            {log.level}
                                        </Badge>
                                    </div>
                                    <div>{log.message}</div>
                                    {log.details && (
                                        <pre className="mt-2 text-xs opacity-75 overflow-x-auto">
                                            {JSON.stringify(log.details, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-neutral-400">
                                No processing logs available
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Job Details Dialog */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Processing Details</DialogTitle>
                        <DialogDescription>
                            Detailed information for &quot;{selectedJob?.video.title}&quot;
                        </DialogDescription>
                    </DialogHeader>

                    {selectedJob && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-neutral-300">Status</label>
                                    <div className="mt-1">
                                        <StatusBadge
                                            status={selectedJob.status}
                                            progress={selectedJob.progress}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-neutral-300">Started At</label>
                                    <div className="mt-1 text-sm text-neutral-0">
                                        {new Date(selectedJob.startedAt).toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-neutral-300">Retry Count</label>
                                    <div className="mt-1 text-sm text-neutral-0">
                                        {selectedJob.retryCount} attempts
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-neutral-300">Cloudflare UID</label>
                                    <div className="mt-1 text-sm text-neutral-0 font-mono">
                                        {selectedJob.video.cloudflare_video_id || 'Not available'}
                                    </div>
                                </div>
                            </div>

                            {selectedJob.error && (
                                <div>
                                    <label className="text-sm font-medium text-neutral-300">Error Details</label>
                                    <div className="mt-1 p-3 bg-error-500/10 rounded-md">
                                        <div className="text-sm text-error-300">
                                            <strong>Code:</strong> {selectedJob.error.code || 'Unknown'}
                                        </div>
                                        <div className="text-sm text-error-300 mt-1">
                                            <strong>Message:</strong> {selectedJob.error.message}
                                        </div>
                                        {selectedJob.error.details && (
                                            <pre className="mt-2 text-xs text-error-400 overflow-x-auto">
                                                {JSON.stringify(selectedJob.error.details, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium text-neutral-300">Video Information</label>
                                <div className="mt-1 space-y-2">
                                    <div className="text-sm">
                                        <span className="text-neutral-400">Duration:</span>{' '}
                                        <span className="text-neutral-0">
                                            {selectedJob.video.duration_seconds ? `${Math.round(selectedJob.video.duration_seconds / 60)}m` : 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-neutral-400">File Size:</span>{' '}
                                        <span className="text-neutral-0">
                                            {'Unknown'}
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-neutral-400">Resolution:</span>{' '}
                                        <span className="text-neutral-0">
                                            {'Unknown'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                            Close
                        </Button>
                        {selectedJob && canManageProcessing && (
                            <>
                                {(selectedJob.status === 'error' || selectedJob.status === 'uploading') && (
                                    <Button
                                        onClick={() => {
                                            handleRetry(selectedJob)
                                            setDetailsDialogOpen(false)
                                        }}
                                        disabled={retryProcessingMutation.isPending}
                                    >
                                        {retryProcessingMutation.isPending ? (
                                            <LoadingSpinner size="sm" />
                                        ) : null}
                                        Retry Processing
                                    </Button>
                                )}
                                {selectedJob.status === 'processing' && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            handleCancel(selectedJob)
                                            setDetailsDialogOpen(false)
                                        }}
                                        disabled={cancelProcessingMutation.isPending}
                                    >
                                        {cancelProcessingMutation.isPending ? (
                                            <LoadingSpinner size="sm" />
                                        ) : null}
                                        Cancel Processing
                                    </Button>
                                )}
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
} 