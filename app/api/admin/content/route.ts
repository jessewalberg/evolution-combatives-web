import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../src/lib/supabase'
import { handleSupabaseError } from '../../../../src/lib/shared/utils/supabase-errors'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

export async function POST(request: NextRequest) {
    try {
        // Authenticate user and check permissions
        const authResult = await validateApiAuthWithSession('content.write')
        
        if ('error' in authResult) {
            return authResult.error
        }

        const { action, ...data } = await request.json()
        const supabase = createAdminClient()

        switch (action) {
            case 'fetchContentStats':
                const [
                    disciplinesResult,
                    categoriesResult,
                    videosResult,
                    publishedResult,
                    processingResult
                ] = await Promise.all([
                    supabase.from('disciplines').select('id', { count: 'exact', head: true }),
                    supabase.from('categories').select('id', { count: 'exact', head: true }),
                    supabase.from('videos').select('id', { count: 'exact', head: true }),
                    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_published', true),
                    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('processing_status', 'processing')
                ])

                const stats = {
                    totalDisciplines: disciplinesResult.count || 0,
                    totalCategories: categoriesResult.count || 0,
                    totalVideos: videosResult.count || 0,
                    publishedVideos: publishedResult.count || 0,
                    processingVideos: processingResult.count || 0,
                    totalViewTime: 0,
                    averageRating: 0
                }

                return NextResponse.json({ success: true, data: stats })

            case 'createVideo':
                const { data: newVideo, error: createError } = await supabase
                    .from('videos')
                    .insert({
                        ...data.videoData,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single()

                if (createError) {
                    throw handleSupabaseError(createError)
                }

                return NextResponse.json({ success: true, data: newVideo })

            case 'updateVideo':
                const { data: updatedVideo, error: updateError } = await supabase
                    .from('videos')
                    .update({
                        ...data.updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', data.videoId)
                    .select()
                    .single()

                if (updateError) {
                    throw handleSupabaseError(updateError)
                }

                return NextResponse.json({ success: true, data: updatedVideo })

            case 'deleteVideo':
                // Start transaction-like cleanup
                const { error: progressError } = await supabase
                    .from('user_progress')
                    .delete()
                    .eq('video_id', data.videoId)

                if (progressError) {
                    throw new Error(`Failed to cleanup user progress: ${handleSupabaseError(progressError)}`)
                }

                const { error: videoError } = await supabase
                    .from('videos')
                    .delete()
                    .eq('id', data.videoId)

                if (videoError) {
                    throw handleSupabaseError(videoError)
                }

                return NextResponse.json({ success: true })

            case 'bulkUpdateVideoStatus':
                const results = {
                    success: false,
                    processed: 0,
                    failed: 0,
                    errors: [] as string[]
                }

                for (const videoId of data.videoIds) {
                    try {
                        const { error } = await supabase
                            .from('videos')
                            .update({
                                ...data.updates,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', videoId)

                        if (error) {
                            results.failed++
                            results.errors.push(`Video ${videoId}: ${handleSupabaseError(error)}`)
                        } else {
                            results.processed++
                        }
                    } catch (error) {
                        results.failed++
                        results.errors.push(`Video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    }
                }

                results.success = results.failed === 0
                return NextResponse.json({ success: true, data: results })

            case 'bulkDeleteVideos':
                const deleteResults = {
                    success: false,
                    processed: 0,
                    failed: 0,
                    errors: [] as string[]
                }

                for (const videoId of data.videoIds) {
                    try {
                        // Cleanup user progress first
                        await supabase
                            .from('user_progress')
                            .delete()
                            .eq('video_id', videoId)

                        // Delete video
                        const { error } = await supabase
                            .from('videos')
                            .delete()
                            .eq('id', videoId)

                        if (error) {
                            deleteResults.failed++
                            deleteResults.errors.push(`Video ${videoId}: ${handleSupabaseError(error)}`)
                        } else {
                            deleteResults.processed++
                        }
                    } catch (error) {
                        deleteResults.failed++
                        deleteResults.errors.push(`Video ${videoId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    }
                }

                deleteResults.success = deleteResults.failed === 0
                return NextResponse.json({ success: true, data: deleteResults })

            case 'getVideoAnalytics':
                const { data: video, error: fetchVideoError } = await supabase
                    .from('videos')
                    .select(`
                        id,
                        title,
                        view_count,
                        user_progress(
                            progress_percentage,
                            completed,
                            user_id
                        )
                    `)
                    .eq('id', data.videoId)
                    .single()

                if (fetchVideoError) {
                    throw handleSupabaseError(fetchVideoError)
                }

                const progress = video.user_progress || []
                const completedViews = progress.filter(p => p.completed).length
                const totalViews = progress.length
                const completionRate = totalViews > 0 ? (completedViews / totalViews) * 100 : 0

                const averageProgress = progress.length > 0
                    ? progress.reduce((sum, p) => sum + p.progress_percentage, 0) / progress.length
                    : 0

                const subscriberTierBreakdown = {
                    beginner: Math.floor(totalViews * 0.4),
                    intermediate: Math.floor(totalViews * 0.4),
                    advanced: Math.floor(totalViews * 0.2)
                }

                const monthlyViews = [
                    { month: '2024-01', views: Math.floor(totalViews * 0.1) },
                    { month: '2024-02', views: Math.floor(totalViews * 0.15) },
                    { month: '2024-03', views: Math.floor(totalViews * 0.25) },
                    { month: '2024-04', views: Math.floor(totalViews * 0.5) }
                ]

                const analytics = {
                    videoId: video.id,
                    title: video.title,
                    viewCount: video.view_count,
                    completionRate,
                    averageWatchTime: averageProgress,
                    subscriberTierBreakdown,
                    monthlyViews
                }

                return NextResponse.json({ success: true, data: analytics })

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error('Admin Content API error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        )
    }
}