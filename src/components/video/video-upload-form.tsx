/**
 * Evolution Combatives Video Upload Form
 * Professional video upload interface for tactical training content
 * Designed for content administrators managing law enforcement training videos
 * 
 * @description Comprehensive video upload with Cloudflare Stream integration
 * @author Evolution Combatives
 */

import * as React from 'react'
import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/loading'
import { LoadingOverlay } from '../ui/loading'
import { cloudflareApi } from '../../lib/cloudflare-api'
import { contentApi } from '../../lib/content-api'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-client'
import { videoProcessingService } from '../../services/video-processing-service'
import {
    CloudArrowUpIcon,
    XMarkIcon,
    PlayIcon,
    ExclamationTriangleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline'

/**
 * Upload status types
 */
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error'

/**
 * File upload interface
 */
interface FileUpload {
    id: string
    file: File
    status: UploadStatus
    progress: number
    uploadSpeed?: number
    error?: string
    streamId?: string
    databaseId?: string
    thumbnailUrl?: string
    metadata?: VideoMetadata
}

/**
 * Video metadata interface
 */
interface VideoMetadata {
    title: string
    description: string
    categoryId: string
    disciplineId: string
    subscriptionTier: 'none' | 'tier1' | 'tier2' | 'tier3'
    tags: string[]
    customThumbnail?: File
    duration?: number
    instructor?: string
}

/**
 * Subscription tier options
 */
const SUBSCRIPTION_TIERS = [
    { value: 'none', label: 'Free Content', description: 'Free content available to all users' },
    { value: 'tier1', label: 'Tier 1 ($9)', description: 'Basic tactical content for new practitioners' },
    { value: 'tier2', label: 'Tier 2 ($19)', description: 'Advanced techniques for experienced practitioners' },
    { value: 'tier3', label: 'Tier 3 ($49)', description: 'Elite content for law enforcement professionals' },
] as const


/**
 * Supported video formats
 */
const SUPPORTED_FORMATS = ['video/mp4', 'video/mov', 'video/quicktime', 'video/avi']
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB

/**
 * Drop zone variants
 */
const dropZoneVariants = {
    base: [
        'relative border-2 border-dashed rounded-lg transition-all duration-200',
        'flex flex-col items-center justify-center p-8 min-h-64',
        'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
    ],
    variants: {
        idle: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300',
        dragover: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
        error: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400',
        success: 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400',
    }
}

/**
 * File preview card variants
 */
const fileCardVariants = {
    base: 'relative p-4 rounded-lg border transition-all duration-200',
    variants: {
        idle: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50',
        uploading: 'border-blue-500 bg-blue-500/10',
        processing: 'border-yellow-500 bg-yellow-500/10',
        complete: 'border-green-500 bg-green-500/10',
        error: 'border-red-500 bg-red-500/10',
    }
}

/**
 * Video upload form props
 */
interface VideoUploadFormProps {
    /**
     * Available categories for selection
     */
    categories?: Array<{ id: string; name: string; disciplineId: string }>

    /**
     * Available disciplines for selection
     */
    disciplines?: Array<{ id: string; name: string }>

    /**
     * Upload success callback
     */
    onSuccess?: (videoId: string) => void

    /**
     * Upload error callback
     */
    onError?: (error: string) => void

    /**
     * Upload start callback
     */
    onUploadStart?: () => void

    /**
     * Upload end callback
     */
    onUploadEnd?: () => void

    /**
     * Loading state for categories/disciplines
     */
    isLoading?: boolean

    /**
     * Upload in progress state
     */
    isUploading?: boolean

    /**
     * Maximum number of files
     */
    maxFiles?: number

    /**
     * Additional CSS classes
     */
    className?: string
}

/**
 * Professional Video Upload Form Component
 */
const VideoUploadForm = React.forwardRef<HTMLDivElement, VideoUploadFormProps>(
    ({
        categories = [],
        disciplines = [],
        onSuccess,
        onError,
        onUploadStart,
        onUploadEnd,
        isLoading = false,
        isUploading = false,
        maxFiles = 5,
        className,
        ...props
    }, ref) => {
        // State management
        const [uploads, setUploads] = useState<FileUpload[]>([])
        const [dragOver, setDragOver] = useState(false)
        const [isProcessing, setIsProcessing] = useState(false)
        const fileInputRef = useRef<HTMLInputElement>(null)
        const queryClient = useQueryClient()

        // Prevent navigation during uploads
        React.useEffect(() => {
            const hasActiveUploads = uploads.some(u => u.status === 'uploading' || u.status === 'processing')

            if (hasActiveUploads) {
                const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                    e.preventDefault()
                    const message = 'You have uploads in progress. Are you sure you want to leave?'
                    e.returnValue = message
                    return message
                }

                window.addEventListener('beforeunload', handleBeforeUnload)
                return () => window.removeEventListener('beforeunload', handleBeforeUnload)
            }
        }, [uploads])

        /**
         * Validate file before upload
         */
        const validateFile = useCallback((file: File): string | null => {
            if (!SUPPORTED_FORMATS.includes(file.type)) {
                return `Unsupported format. Please use MP4, MOV, or AVI files.`
            }

            if (file.size > MAX_FILE_SIZE) {
                return `File too large. Maximum size is 5GB.`
            }

            return null
        }, [])

        /**
         * Generate file thumbnail
         */
        const generateThumbnail = useCallback((file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const video = document.createElement('video')
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight
                    video.currentTime = 1 // Seek to 1 second for thumbnail
                }

                video.onseeked = () => {
                    if (ctx) {
                        ctx.drawImage(video, 0, 0)
                        resolve(canvas.toDataURL('image/jpeg', 0.8))
                    } else {
                        reject(new Error('Canvas context not available'))
                    }
                }

                video.onerror = () => reject(new Error('Failed to load video'))
                video.src = URL.createObjectURL(file)
            })
        }, [])

        /**
         * Handle file selection
         */
        const handleFiles = useCallback(async (files: FileList) => {
            const fileArray = Array.from(files)

            if (uploads.length + fileArray.length > maxFiles) {
                onError?.(`Maximum ${maxFiles} files allowed`)
                return
            }

            const newUploads: FileUpload[] = []

            for (const file of fileArray) {
                const error = validateFile(file)

                if (error) {
                    onError?.(error)
                    continue
                }

                const upload: FileUpload = {
                    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    file,
                    status: 'idle',
                    progress: 0,
                    metadata: {
                        title: file.name.replace(/\.[^/.]+$/, ''),
                        description: '',
                        categoryId: '',
                        disciplineId: '',
                        subscriptionTier: 'none',
                        tags: [],
                    }
                }

                try {
                    upload.thumbnailUrl = await generateThumbnail(file)
                } catch (error) {
                    // Silently fail thumbnail generation
                }

                newUploads.push(upload)
            }

            setUploads(prev => [...prev, ...newUploads])
        }, [uploads.length, maxFiles, validateFile, generateThumbnail, onError])

        /**
         * Handle drag events
         */
        const handleDragOver = useCallback((e: React.DragEvent) => {
            e.preventDefault()
            setDragOver(true)
        }, [])

        const handleDragLeave = useCallback((e: React.DragEvent) => {
            e.preventDefault()
            setDragOver(false)
        }, [])

        const handleDrop = useCallback((e: React.DragEvent) => {
            e.preventDefault()
            setDragOver(false)

            const files = e.dataTransfer.files
            if (files.length > 0) {
                handleFiles(files)
            }
        }, [handleFiles])

        /**
         * Handle file input change
         */
        const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files
            if (files) {
                handleFiles(files)
            }
            // Reset input value to allow same file selection
            e.target.value = ''
        }, [handleFiles])

        /**
         * Handle processing completion via background service
         * The background service will handle status updates automatically
         */
        const handleProcessingStart = useCallback((uploadId: string, streamId: string) => {
            // Add to background processing service
            videoProcessingService.addProcessingVideo(streamId)

            // Mark as processing in local state
            setUploads(prev => prev.map(u =>
                u.id === uploadId
                    ? { ...u, status: 'processing' }
                    : u
            ))

            console.log(`Video ${streamId} added to background processing service`)
        }, [])

        /**
         * Upload file to Cloudflare Stream
         */
        const uploadToStream = useCallback(async (upload: FileUpload) => {
            let videoId: string | undefined
            try {
                // Validate metadata before upload
                if (!upload.metadata?.title || !upload.metadata?.categoryId || !upload.metadata?.disciplineId) {
                    throw new Error('Please fill in all required fields (title, category, discipline)')
                }

                setUploads(prev => prev.map(u =>
                    u.id === upload.id
                        ? { ...u, status: 'uploading', progress: 0 }
                        : u
                ))

                // Get upload URL from Cloudflare Stream
                const uploadResponse = await cloudflareApi.getUploadUrl({
                    metadata: {
                        name: upload.metadata.title,
                        title: upload.metadata.title,
                        description: upload.metadata.description || '',
                        category: upload.metadata.categoryId,
                        discipline: upload.metadata.disciplineId,
                        subscriptionTier: upload.metadata.subscriptionTier
                    }
                })

                const { uploadUrl } = uploadResponse
                videoId = uploadResponse.videoId

                // Upload file to Cloudflare Stream
                await cloudflareApi.uploadVideo(
                    upload.file,
                    uploadUrl,
                    (progress: number) => {
                        setUploads(prev => prev.map(u =>
                            u.id === upload.id
                                ? { ...u, progress: Math.round(progress) }
                                : u
                        ))
                    }
                )

                // Set to processing status
                setUploads(prev => prev.map(u =>
                    u.id === upload.id
                        ? {
                            ...u,
                            status: 'processing',
                            progress: 100,
                            streamId: videoId
                        }
                        : u
                ))

                const createdVideo = await contentApi.createVideo({
                    id: videoId,
                    title: upload.metadata.title,
                    description: upload.metadata.description || '',
                    slug: upload.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                    categoryId: upload.metadata.categoryId,
                    subscriptionTier: upload.metadata.subscriptionTier,
                    status: 'processing',
                    duration: 0,
                    tags: upload.metadata.tags || [],
                    isPublished: false,
                    fileSize: upload.file.size,
                    categoryName: categories.find(c => c.id === upload.metadata?.categoryId)?.name || '',
                    disciplineId: upload.metadata.disciplineId,
                    disciplineName: disciplines.find(d => d.id === upload.metadata?.disciplineId)?.name || '',
                    uploadDate: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    viewCount: 0,
                    completionRate: 0,
                })

                console.log('Video created successfully:', createdVideo)

                // Update upload with database ID
                setUploads(prev => prev.map(u =>
                    u.id === upload.id
                        ? { ...u, databaseId: createdVideo.id }
                        : u
                ))

                // Invalidate queries to refresh video list
                queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
                queryClient.invalidateQueries({ queryKey: queryKeys.videosList() })

                // Start background processing monitoring
                handleProcessingStart(upload.id, videoId)

                // Call success callback
                onSuccess?.(videoId)

            } catch (error) {
                console.error('Upload failed:', error)
                console.error('Error details:', {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    uploadId: upload.id,
                    videoId: videoId || 'unknown'
                })
                setUploads(prev => prev.map(u =>
                    u.id === upload.id
                        ? {
                            ...u,
                            status: 'error',
                            error: error instanceof Error ? error.message : 'Upload failed'
                        }
                        : u
                ))
                onError?.(error instanceof Error ? error.message : 'Upload failed')
            }
        }, [handleProcessingStart, onError, onSuccess, categories, disciplines, queryClient])

        /**
         * Update metadata for upload
         */
        const updateMetadata = useCallback((uploadId: string, metadata: Partial<VideoMetadata>) => {
            setUploads(prev => prev.map(u =>
                u.id === uploadId
                    ? {
                        ...u,
                        metadata: { ...u.metadata, ...metadata } as VideoMetadata,
                        // Clear error if user is filling in required fields
                        error: metadata.title || metadata.disciplineId || metadata.categoryId
                            ? undefined
                            : u.error
                    }
                    : u
            ))
        }, [])

        /**
         * Remove upload
         */
        const removeUpload = useCallback((uploadId: string) => {
            setUploads(prev => prev.filter(u => u.id !== uploadId))
        }, [])

        /**
         * Validate upload metadata
         */
        const validateUpload = useCallback((upload: FileUpload): string[] => {
            const errors: string[] = []

            if (!upload.metadata?.title?.trim()) {
                errors.push('Title is required')
            }

            if (!upload.metadata?.disciplineId) {
                errors.push('Discipline is required')
            }

            if (!upload.metadata?.categoryId) {
                errors.push('Category is required')
            }

            return errors
        }, [])

        /**
         * Start all uploads
         */
        const startUploads = useCallback(async () => {
            const pendingUploads = uploads.filter(u => u.status === 'idle')

            if (pendingUploads.length === 0) {
                onError?.('No files ready for upload')
                return
            }

            // Validate all uploads and collect detailed error information
            const validationErrors: { uploadId: string; fileName: string; errors: string[] }[] = []

            pendingUploads.forEach(upload => {
                const errors = validateUpload(upload)
                if (errors.length > 0) {
                    validationErrors.push({
                        uploadId: upload.id,
                        fileName: upload.file.name,
                        errors
                    })
                }
            })

            if (validationErrors.length > 0) {
                // Create detailed error message
                const errorMessage = validationErrors.map(({ fileName, errors }) =>
                    `${fileName}: ${errors.join(', ')}`
                ).join('\n')

                onError?.(`Please complete all required fields:\n${errorMessage}`)

                // Mark uploads with validation errors
                setUploads(prev => prev.map(upload => {
                    const hasError = validationErrors.some(err => err.uploadId === upload.id)
                    return hasError ? { ...upload, error: 'Please fill in all required fields' } : upload
                }))

                return
            }

            // Clear any previous validation errors
            setUploads(prev => prev.map(upload => ({ ...upload, error: undefined })))

            setIsProcessing(true)
            onUploadStart?.()

            try {
                // Process uploads sequentially to avoid overwhelming the system
                for (const upload of pendingUploads) {
                    await uploadToStream(upload)
                }
            } catch (error) {
                onError?.(error instanceof Error ? error.message : 'Upload failed')
            } finally {
                setIsProcessing(false)
                onUploadEnd?.()
            }
        }, [uploads, uploadToStream, onUploadStart, onUploadEnd, onError, validateUpload])

        /**
         * Format file size
         */
        const formatFileSize = useCallback((bytes: number): string => {
            if (bytes === 0) return '0 Bytes'
            const k = 1024
            const sizes = ['Bytes', 'KB', 'MB', 'GB']
            const i = Math.floor(Math.log(bytes) / Math.log(k))
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
        }, [])

        /**
         * Format upload speed
         */
        const formatSpeed = useCallback((bytesPerSecond: number): string => {
            return `${formatFileSize(bytesPerSecond)}/s`
        }, [formatFileSize])

        return (
            <div ref={ref} className={cn('space-y-6', className)} {...props}>
                {/* Upload Drop Zone */}
                <Card className="p-0 overflow-hidden">
                    <div
                        className={cn(
                            dropZoneVariants.base,
                            dragOver ? dropZoneVariants.variants.dragover : dropZoneVariants.variants.idle
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <CloudArrowUpIcon className="h-16 w-16 mb-4 text-current" />
                        <h3 className="text-xl font-semibold mb-2">
                            {dragOver ? 'Drop files here' : 'Upload Training Videos'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 text-center max-w-md">
                            Drag and drop video files here, or click to browse.
                            Supports MP4, MOV, and AVI up to 5GB each.
                        </p>
                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Max {maxFiles} files</span>
                            <span>•</span>
                            <span>Up to 5GB each</span>
                            <span>•</span>
                            <span>MP4, MOV, AVI</span>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="video/*"
                            className="hidden"
                            onChange={handleFileInput}
                        />
                    </div>
                </Card>

                {/* Upload Queue */}
                {uploads.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Upload Queue ({uploads.length})
                            </h3>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="default"
                                    onClick={() => setUploads([])}
                                    disabled={isProcessing}
                                    leftIcon={<TrashIcon className="h-4 w-4" />}
                                    className="hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600"
                                >
                                    Clear All
                                </Button>
                                {(() => {
                                    const pendingUploads = uploads.filter(u => u.status === 'idle')
                                    const hasValidationErrors = pendingUploads.some(u => {
                                        const errors = validateUpload(u)
                                        return errors.length > 0
                                    })
                                    const noFilesToUpload = pendingUploads.length === 0

                                    return (
                                        <Button
                                            variant="primary"
                                            size="default"
                                            onClick={startUploads}
                                            disabled={isProcessing || isUploading || noFilesToUpload || hasValidationErrors}
                                            loading={isProcessing || isUploading}
                                            loadingText={isUploading ? 'Uploading...' : 'Processing...'}
                                            leftIcon={<CloudArrowUpIcon className="h-4 w-4" />}
                                            className="min-w-[140px]"
                                            title={
                                                hasValidationErrors
                                                    ? 'Please complete all required fields before uploading'
                                                    : noFilesToUpload
                                                        ? 'No files ready for upload'
                                                        : 'Start uploading videos'
                                            }
                                        >
                                            {hasValidationErrors ? 'Complete Required Fields' : 'Start Upload'}
                                        </Button>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Validation Summary */}
                        {uploads.some(u => u.error && u.status === 'idle') && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                                            Incomplete Required Fields
                                        </h4>
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            Please complete all required fields (marked with *) for each video before uploading.
                                            Missing fields are highlighted in red below.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* File Cards */}
                        <div className="grid gap-4">
                            {uploads.map((upload) => (
                                <Card
                                    key={upload.id}
                                    className={cn(
                                        fileCardVariants.base,
                                        fileCardVariants.variants[upload.status]
                                    )}
                                >
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {/* Thumbnail */}
                                        <div className="flex-shrink-0 w-full sm:w-24 h-16 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                            {upload.thumbnailUrl ? (
                                                <Image
                                                    src={upload.thumbnailUrl}
                                                    alt="Video thumbnail"
                                                    width={96}
                                                    height={64}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <PlayIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                                            )}
                                        </div>

                                        {/* File Info & Metadata */}
                                        <div className="flex-1 min-w-0 space-y-3">
                                            {/* File Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                                            {upload.file.name}
                                                        </h4>
                                                        <Badge variant={
                                                            upload.status === 'complete' ? 'success' :
                                                                upload.status === 'error' ? 'error' :
                                                                    upload.status === 'processing' ? 'warning' :
                                                                        upload.status === 'uploading' ? 'info' : 'secondary'
                                                        }>
                                                            {upload.status === 'idle' && 'Ready'}
                                                            {upload.status === 'uploading' && 'Uploading'}
                                                            {upload.status === 'processing' && 'Processing'}
                                                            {upload.status === 'complete' && 'Complete'}
                                                            {upload.status === 'error' && 'Error'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                                        {formatFileSize(upload.file.size)}
                                                        {upload.uploadSpeed && (
                                                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                                                                • {formatSpeed(upload.uploadSpeed)}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeUpload(upload.id)}
                                                        disabled={upload.status === 'uploading'}
                                                        leftIcon={<XMarkIcon className="h-4 w-4" />}
                                                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                    >
                                                        <span className="sr-only">Remove file</span>
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            {(upload.status === 'uploading' || upload.status === 'processing') && (
                                                <Progress
                                                    value={upload.progress}
                                                    variant={upload.status === 'processing' ? 'warning' : 'primary'}
                                                    size="sm"
                                                    showValue
                                                    indeterminate={upload.status === 'processing'}
                                                />
                                            )}

                                            {/* Error Message */}
                                            {upload.status === 'error' && upload.error && (
                                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                                                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                                                    <span className="font-medium">Error:</span>
                                                    <span>{upload.error}</span>
                                                </div>
                                            )}

                                            {/* Metadata Form */}
                                            {(upload.status === 'idle' || upload.status === 'complete' || upload.status === 'error') && (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Title *
                                                            </label>
                                                            <Input
                                                                placeholder="Enter video title"
                                                                value={upload.metadata?.title || ''}
                                                                onChange={(e) => updateMetadata(upload.id, { title: e.target.value })}
                                                                disabled={upload.status === 'complete'}
                                                                className={cn(
                                                                    "w-full",
                                                                    upload.error && !upload.metadata?.title?.trim() &&
                                                                    "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                                )}
                                                            />
                                                            {upload.error && !upload.metadata?.title?.trim() && (
                                                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                                    Title is required
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Description
                                                            </label>
                                                            <textarea
                                                                placeholder="Enter video description"
                                                                value={upload.metadata?.description || ''}
                                                                onChange={(e) => updateMetadata(upload.id, { description: e.target.value })}
                                                                disabled={upload.status === 'complete'}
                                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                                                rows={3}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Discipline *
                                                            </label>
                                                            <select
                                                                value={upload.metadata?.disciplineId || ''}
                                                                onChange={(e) => updateMetadata(upload.id, { disciplineId: e.target.value })}
                                                                disabled={upload.status === 'complete' || isLoading}
                                                                className={cn(
                                                                    "w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                                                                    upload.error && !upload.metadata?.disciplineId &&
                                                                    "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                                )}
                                                            >
                                                                <option value="">{isLoading ? 'Loading...' : 'Select discipline'}</option>
                                                                {disciplines.map(discipline => (
                                                                    <option key={discipline.id} value={discipline.id}>
                                                                        {discipline.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {upload.error && !upload.metadata?.disciplineId && (
                                                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                                    Discipline is required
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Category *
                                                            </label>
                                                            <select
                                                                value={upload.metadata?.categoryId || ''}
                                                                onChange={(e) => updateMetadata(upload.id, { categoryId: e.target.value })}
                                                                disabled={upload.status === 'complete' || !upload.metadata?.disciplineId || isLoading}
                                                                className={cn(
                                                                    "w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                                                                    upload.error && !upload.metadata?.categoryId &&
                                                                    "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                                )}
                                                            >
                                                                <option value="">{isLoading ? 'Loading...' : 'Select category'}</option>
                                                                {categories
                                                                    .filter(cat => cat.disciplineId === upload.metadata?.disciplineId)
                                                                    .map(category => (
                                                                        <option key={category.id} value={category.id}>
                                                                            {category.name}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            {upload.error && !upload.metadata?.categoryId && (
                                                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                                    Category is required
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Subscription Tier & Difficulty *
                                                            </label>
                                                            <select
                                                                value={upload.metadata?.subscriptionTier || 'none'}
                                                                onChange={(e) => updateMetadata(upload.id, {
                                                                    subscriptionTier: e.target.value as 'none' | 'tier1' | 'tier2' | 'tier3'
                                                                })}
                                                                disabled={upload.status === 'complete'}
                                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                            >
                                                                {SUBSCRIPTION_TIERS.map(tier => (
                                                                    <option key={tier.value} value={tier.value}>
                                                                        {tier.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Processing Overlay */}
                <LoadingOverlay
                    isVisible={isProcessing}
                    message="Processing video uploads..."
                    variant="modal"
                />
            </div>
        )
    }
)

VideoUploadForm.displayName = 'VideoUploadForm'

export default VideoUploadForm
export { VideoUploadForm }
export type { VideoUploadFormProps, FileUpload, VideoMetadata } 