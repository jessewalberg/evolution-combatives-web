/**
 * Evolution Combatives - Video Edit Page
 * Comprehensive video editing interface for tactical training content
 * 
 * @description Video edit page with form validation, thumbnail management, and optimistic updates
 * @author Evolution Combatives
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import Image from 'next/image'

import { useAuth } from '../../../../../../src/hooks/useAuth'
import { Button } from '../../../../../../src/components/ui/button'
import { Input } from '../../../../../../src/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../../../../src/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../../src/components/ui/card'
import { Badge } from '../../../../../../src/components/ui/badge'
import { Spinner } from '../../../../../../src/components/ui/loading'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../../../../src/components/ui/dialog'

import { clientContentService } from '../../../../../../src/services/content-client'
import { cloudflareApi } from '../../../../../../src/lib/cloudflare-api'
import { queryKeys } from '../../../../../../src/lib/query-client'
import type { VideoUpdate } from 'shared/types/database'

// Icons
import {
    ArrowLeftIcon,
    PlayIcon,
    PencilIcon,
    TrashIcon,
    PhotoIcon,
    CloudArrowUpIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon
} from '@heroicons/react/24/outline'

// Form validation schema
const videoEditSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters long.').max(100, 'Title must be 100 characters or less.'),
    description: z.string().min(10, 'Description must be at least 10 characters long.').max(1000, 'Description must be 1000 characters or less.'),
    categoryId: z.string().uuid('Please select a valid category.'),
    subscriptionTierRequired: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    isPublished: z.boolean(),
    tags: z.string().optional(),
    customThumbnail: z.instanceof(File).optional(),
})

type VideoEditFormValues = z.infer<typeof videoEditSchema>

// Custom Textarea Component
const CustomTextarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
        className={`w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[80px] ${className || ''}`}
        {...props}
    />
)

// Custom Select Component
const CustomSelect = ({
    placeholder,
    options,
    value,
    onChange,
    disabled
}: {
    placeholder?: string
    options: Array<{ value: string; label: string }>
    value?: string
    onChange?: (value: string) => void
    disabled?: boolean
}) => (
    <div className="relative">
        <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-10"
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
)

export default function VideoEditPage() {
    const router = useRouter()
    const params = useParams()
    const videoId = params.id as string
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()

    // State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)

    // Check permissions
    const canEditContent = hasPermission('content.write')
    const canDeleteContent = hasPermission('content.delete')

    // Queries
    const videoQuery = useQuery({
        queryKey: queryKeys.videoDetail(videoId),
        queryFn: () => clientContentService.fetchVideoById(videoId),
        enabled: !!videoId && !!user && !!profile?.admin_role,
    })

    const categoriesQuery = useQuery({
        queryKey: queryKeys.categoriesList(),
        queryFn: () => clientContentService.fetchCategories(),
        enabled: !!user && !!profile?.admin_role,
    })

    // Form setup
    const form = useForm<VideoEditFormValues>({
        resolver: zodResolver(videoEditSchema),
        defaultValues: {
            title: '',
            description: '',
            subscriptionTierRequired: 'none',
            isPublished: false,
            tags: '',
        },
    })

    // Set form values when video data loads
    useEffect(() => {
        if (videoQuery.data) {
            const video = videoQuery.data
            form.reset({
                title: video.title,
                description: video.description || '',
                categoryId: video.category_id,
                subscriptionTierRequired: video.tier_required,
                isPublished: video.is_published || false,
                tags: video.tags?.join(', ') || '',
            })
            setIsDirty(false)
        }
    }, [videoQuery.data, form])

    // Generate video preview URL when video loads
    useEffect(() => {
        const generatePreviewUrl = async () => {
            if (videoQuery.data?.cloudflare_video_id && videoQuery.data.processing_status === 'ready') {
                try {
                    const previewUrl = await cloudflareApi.generateAdminPreviewUrl(
                        videoQuery.data.cloudflare_video_id
                    )
                    setVideoPreviewUrl(previewUrl)
                } catch (error) {
                    console.error('Failed to generate preview URL:', error)
                }
            }
        }

        generatePreviewUrl()
    }, [videoQuery.data])

    // Watch for form changes
    useEffect(() => {
        const subscription = form.watch(() => {
            setIsDirty(true)
        })
        return () => subscription.unsubscribe()
    }, [form])

    // Mutations
    const updateVideoMutation = useMutation({
        mutationFn: async (data: VideoEditFormValues) => {
            const updateData: VideoUpdate = {
                title: data.title,
                description: data.description,
                category_id: data.categoryId,
                tier_required: data.subscriptionTierRequired,
                is_published: data.isPublished,
                tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
            }

            // Handle custom thumbnail upload if provided
            if (data.customThumbnail && videoQuery.data?.id) {
                try {
                    const thumbnailUrl = await cloudflareApi.uploadCustomThumbnail(
                        videoQuery.data.id, // Use database video ID
                        data.customThumbnail
                    )
                    updateData.thumbnail_url = thumbnailUrl
                    toast.success('Custom thumbnail uploaded successfully')
                } catch (error) {
                    console.error('Failed to upload custom thumbnail:', error)
                    toast.error('Failed to upload custom thumbnail')
                    // Continue with other updates even if thumbnail upload fails
                }
            }

            return clientContentService.updateVideo(videoId, updateData)
        },
        onMutate: async (newData) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.videoDetail(videoId) })

            // Snapshot the previous value
            const previousVideo = queryClient.getQueryData(queryKeys.videoDetail(videoId))

            // Optimistically update to the new value
            if (previousVideo) {
                const updates: Record<string, unknown> = {
                    ...previousVideo,
                    title: newData.title,
                    description: newData.description,
                    category_id: newData.categoryId,
                    tier_required: newData.subscriptionTierRequired,
                    is_published: newData.isPublished,
                    tags: newData.tags ? newData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
                    updated_at: new Date().toISOString(),
                }

                // If custom thumbnail is being uploaded, we'll keep the existing thumbnail_url
                // The actual URL will be updated after the upload completes

                queryClient.setQueryData(queryKeys.videoDetail(videoId), updates)
            }

            return { previousVideo }
        },
        onError: (err, newData, context) => {
            // Rollback on error
            if (context?.previousVideo) {
                queryClient.setQueryData(queryKeys.videoDetail(videoId), context.previousVideo)
            }
            toast.error('Failed to update video', {
                description: err.message
            })
        },
        onSuccess: () => {
            toast.success('Video updated successfully')
            setIsDirty(false)
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
        },
        onSettled: () => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey: queryKeys.videoDetail(videoId) })
        },
    })

    const deleteVideoMutation = useMutation({
        mutationFn: () => clientContentService.deleteVideo(videoId),
        onSuccess: () => {
            toast.success('Video deleted successfully')
            // Invalidate video list and navigate back
            queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
            router.push('/dashboard/content/videos')
        },
        onError: (err: Error) => {
            toast.error('Failed to delete video', {
                description: err.message
            })
        },
    })

    // Handlers
    const handleSubmit = (data: VideoEditFormValues) => {
        updateVideoMutation.mutate(data)
    }

    const handleDelete = () => {
        deleteVideoMutation.mutate()
        setIsDeleteDialogOpen(false)
    }

    const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            // Validate file type and size
            if (!file.type.startsWith('image/')) {
                toast.error('Please select a valid image file')
                return
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error('Image file must be less than 5MB')
                return
            }

            form.setValue('customThumbnail', file)

            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
                setThumbnailPreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
            setIsDirty(true)
        }
    }

    const handleBackClick = () => {
        if (isDirty) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?')
            if (!confirmed) return
        }
        router.push('/dashboard/content/videos')
    }

    // Loading and error states
    if (authLoading || videoQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (videoQuery.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
                <XCircleIcon className="h-16 w-16 text-error-500" />
                <h1 className="text-2xl font-bold text-neutral-0">Video Not Found</h1>
                <p className="text-neutral-400">The video you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
                <Button onClick={() => router.push('/dashboard/content/videos')}>
                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                    Back to Videos
                </Button>
            </div>
        )
    }

    const video = videoQuery.data!
    const categories = categoriesQuery.data || []

    return (
        <div className="min-h-screen bg-neutral-950 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" onClick={handleBackClick}>
                            <ArrowLeftIcon className="h-4 w-4 mr-2" />
                            Back to Videos
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold text-neutral-0">Edit Video</h1>
                            <p className="text-neutral-400">Modify video details and settings</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {video.processing_status && (
                            <Badge variant={
                                video.processing_status === 'ready' ? 'success' :
                                    video.processing_status === 'error' ? 'error' :
                                        'warning'
                            }>
                                {video.processing_status === 'ready' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                                {video.processing_status === 'error' && <XCircleIcon className="h-3 w-3 mr-1" />}
                                {(video.processing_status === 'uploading' || video.processing_status === 'processing') && <ClockIcon className="h-3 w-3 mr-1" />}
                                {video.processing_status}
                            </Badge>
                        )}

                        {canDeleteContent && (
                            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <TrashIcon className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete Video</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to delete &quot;{video.title}&quot;? This action cannot be undone and will remove all associated user progress.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={handleDelete}
                                            disabled={deleteVideoMutation.isPending}
                                        >
                                            {deleteVideoMutation.isPending ? 'Deleting...' : 'Delete Video'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <PencilIcon className="h-5 w-5 mr-2" />
                                    Video Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="title"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Title</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="e.g., Weapon Retention Basics"
                                                            {...field}
                                                            disabled={!canEditContent || updateVideoMutation.isPending}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <CustomTextarea
                                                            placeholder="Detailed description of the video content and learning objectives..."
                                                            {...field}
                                                            disabled={!canEditContent || updateVideoMutation.isPending}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="categoryId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Category</FormLabel>
                                                        <FormControl>
                                                            <CustomSelect
                                                                placeholder="Select a category"
                                                                options={categories.map(cat => ({
                                                                    value: cat.id,
                                                                    label: cat.name
                                                                }))}
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                disabled={!canEditContent || updateVideoMutation.isPending}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="subscriptionTierRequired"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Required Tier</FormLabel>
                                                        <FormControl>
                                                            <CustomSelect
                                                                placeholder="Select required tier"
                                                                options={[
                                                                    { value: 'none', label: 'Free Content' },
                                                                    { value: 'tier1', label: 'Tier 1 - Beginner ($9)' },
                                                                    { value: 'tier2', label: 'Tier 2 - Intermediate ($19)' },
                                                                    { value: 'tier3', label: 'Tier 3 - Advanced ($49)' }
                                                                ]}
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                disabled={!canEditContent || updateVideoMutation.isPending}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="tags"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tags (comma-separated)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="e.g., defensive tactics, weapon retention, close quarters"
                                                            {...field}
                                                            disabled={!canEditContent || updateVideoMutation.isPending}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="isPublished"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            id="isPublished"
                                                            checked={field.value}
                                                            onChange={field.onChange}
                                                            disabled={!canEditContent || updateVideoMutation.isPending}
                                                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-700 rounded bg-neutral-800"
                                                        />
                                                        <FormLabel htmlFor="isPublished" className="text-sm font-medium">
                                                            Published (visible to users)
                                                        </FormLabel>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {canEditContent && (
                                            <div className="flex justify-end space-x-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => form.reset()}
                                                    disabled={updateVideoMutation.isPending}
                                                >
                                                    Reset
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={updateVideoMutation.isPending || !isDirty}
                                                >
                                                    {updateVideoMutation.isPending ? 'Saving...' : 'Save Changes'}
                                                </Button>
                                            </div>
                                        )}
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Video Preview */}
                        {video.processing_status === 'ready' && videoPreviewUrl && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <PlayIcon className="h-5 w-5 mr-2" />
                                        Video Preview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden">
                                        <video
                                            src={videoPreviewUrl}
                                            controls
                                            className="w-full h-full object-cover"
                                            poster={video.thumbnail_url || undefined}
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Thumbnail Management */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <PhotoIcon className="h-5 w-5 mr-2" />
                                    Thumbnail
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden">
                                    {thumbnailPreview ? (
                                        <Image
                                            src={thumbnailPreview}
                                            alt="Custom thumbnail preview"
                                            width={320}
                                            height={180}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : video.thumbnail_url ? (
                                        <Image
                                            src={video.thumbnail_url}
                                            alt="Video thumbnail"
                                            width={320}
                                            height={180}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                                            <PhotoIcon className="h-12 w-12" />
                                        </div>
                                    )}
                                </div>

                                {canEditContent && (
                                    <div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailChange}
                                            className="hidden"
                                            id="thumbnail-upload"
                                            disabled={updateVideoMutation.isPending}
                                        />
                                        <label
                                            htmlFor="thumbnail-upload"
                                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-neutral-0 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                        >
                                            <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                                            Upload Custom Thumbnail
                                        </label>
                                        <p className="text-xs text-neutral-500 mt-2">
                                            JPG, PNG up to 5MB. Recommended: 1280x720px
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Video Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Video Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Created</span>
                                    <span className="text-neutral-0">
                                        {new Date(video.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Last Updated</span>
                                    <span className="text-neutral-0">
                                        {new Date(video.updated_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {video.duration_seconds && (
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Duration</span>
                                        <span className="text-neutral-0">
                                            {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                )}
                                {video.cloudflare_video_id && (
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Stream ID</span>
                                        <span className="text-neutral-0 font-mono text-xs">
                                            {video.cloudflare_video_id.substring(0, 8)}...
                                        </span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
} 