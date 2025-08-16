/**
 * Evolution Combatives - Video Upload Page
 * Professional video upload interface for tactical training content
 * 
 * @description Video upload page with drag-and-drop, progress tracking, and metadata management
 * @author Evolution Combatives
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../../../src/hooks/useAuth'
import { Card } from '../../../../../src/components/ui/card'
import { Button } from '../../../../../src/components/ui/button'
import { Breadcrumb } from '../../../../../src/components/ui/breadcrumb'
import { VideoUploadForm } from '../../../../../src/components/video/video-upload-form'
import { contentApi } from '../../../../../src/lib/content-api'
import { queryKeys } from '../../../../../src/lib/query-client'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function VideoUploadPage() {
    const router = useRouter()
    const { user, profile, hasPermission } = useAuth()
    const [isUploading, setIsUploading] = useState(false)

    // Check permissions
    const canUploadContent = hasPermission('content.write')

    // Fetch categories and disciplines for the form
    const categoriesQuery = useQuery({
        queryKey: queryKeys.categoriesList(),
        queryFn: () => contentApi.fetchCategories(),
        enabled: !!user && !!profile?.admin_role
    })

    const disciplinesQuery = useQuery({
        queryKey: queryKeys.disciplinesList(),
        queryFn: () => contentApi.fetchDisciplines(),
        enabled: !!user && !!profile?.admin_role
    })

    // Handle successful upload
    const handleUploadSuccess = (videoId: string) => {
        toast.success('Video uploaded successfully!')
        router.push(`/dashboard/content/videos/${videoId}/edit`)
    }

    // Handle upload error
    const handleUploadError = (error: string) => {
        toast.error(`Upload failed: ${error}`)
        setIsUploading(false)
    }

    // Redirect if no permission
    if (!canUploadContent) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card className="p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
                    <p className="text-gray-600 mb-6">
                        You don&apos;t have permission to upload videos.
                    </p>
                    <Button 
                        onClick={() => router.push('/dashboard/content/videos')}
                        variant="outline"
                    >
                        Back to Videos
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Breadcrumb Navigation */}
            <Breadcrumb 
                className="mb-6"
                items={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Content', href: '/dashboard/content' },
                    { label: 'Videos', href: '/dashboard/content/videos' },
                    { label: 'Upload', isCurrent: true }
                ]}
            />

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="p-2"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Upload Video</h1>
                    <p className="text-gray-600 mt-1">
                        Add new tactical training content to the platform
                    </p>
                </div>
            </div>

            {/* Upload Form */}
            <Card className="max-w-4xl">
                <div className="p-6">
                    <VideoUploadForm
                        categories={(categoriesQuery.data || []).map(cat => ({
                            id: cat.id,
                            name: cat.name,
                            disciplineId: cat.discipline_id
                        }))}
                        disciplines={(disciplinesQuery.data || []).map(disc => ({
                            id: disc.id,
                            name: disc.name
                        }))}
                        isLoading={categoriesQuery.isLoading || disciplinesQuery.isLoading}
                        onSuccess={handleUploadSuccess}
                        onError={handleUploadError}
                        onUploadStart={() => setIsUploading(true)}
                        onUploadEnd={() => setIsUploading(false)}
                        isUploading={isUploading}
                    />
                </div>
            </Card>
        </div>
    )
}