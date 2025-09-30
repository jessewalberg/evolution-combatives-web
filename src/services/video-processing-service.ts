/**
 * Evolution Combatives - Video Processing Background Service
 * Handles video processing status updates independently of UI components
 * 
 * @description Background service to sync video processing status from Cloudflare
 * @author Evolution Combatives
 */

// Dynamic import of cloudflareStreamService to avoid environment variable issues

/**
 * Video processing background service
 * Runs independently of React components to ensure processing status is always updated
 */
class VideoProcessingService {
    private intervalId: NodeJS.Timeout | null = null
    private readonly CHECK_INTERVAL = 10000 // Check every 10 seconds
    private processingVideos = new Set<string>()

    /**
     * Start the background processing service
     */
    start() {
        // Only run on server-side
        if (typeof window !== 'undefined') {
            console.warn('Video processing service should only run on server-side')
            return
        }

        if (this.intervalId) {
            return // Already running
        }

        console.log('Starting video processing service...')
        this.intervalId = setInterval(() => {
            this.checkProcessingVideos()
        }, this.CHECK_INTERVAL)

        // Also check immediately
        this.checkProcessingVideos()
    }

    /**
     * Stop the background processing service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
            console.log('Video processing service stopped')
        }
    }

    /**
     * Add a video to the processing queue
     */
    addProcessingVideo(cloudflareVideoId: string) {
        // Only run on server-side
        if (typeof window !== 'undefined') {
            console.log('Video processing service is client-side, skipping processing queue')
            return
        }

        this.processingVideos.add(cloudflareVideoId)
        console.log(`Added video to processing queue: ${cloudflareVideoId}`)
    }

    /**
     * Remove a video from the processing queue
     */
    removeProcessingVideo(cloudflareVideoId: string) {
        this.processingVideos.delete(cloudflareVideoId)
        console.log(`Removed video from processing queue: ${cloudflareVideoId}`)
    }

    /**
     * Check all processing videos and update their status
     */
    private async checkProcessingVideos() {
        // Only run on server-side
        if (typeof window !== 'undefined') {
            return
        }

        if (this.processingVideos.size === 0) {
            return
        }

        console.log(`Checking ${this.processingVideos.size} processing videos...`)

        for (const cloudflareVideoId of this.processingVideos) {
            try {
                await this.checkSingleVideo(cloudflareVideoId)
            } catch (error) {
                console.error(`Error checking video ${cloudflareVideoId}:`, error)
            }
        }
    }

    /**
     * Check a single video's processing status
     */
    private async checkSingleVideo(cloudflareVideoId: string) {
        try {
            // Dynamic import to avoid environment variable issues
            const { cloudflareStreamService } = await import('./cloudflare-stream')

            // Check Cloudflare status
            const status = await cloudflareStreamService.upload.checkUploadStatus(cloudflareVideoId)

            if (status.status === 'ready') {
                // Video is ready, get video details for duration
                const videoDetails = await cloudflareStreamService.video.getVideoDetails(cloudflareVideoId)
                await this.updateVideoStatus(cloudflareVideoId, 'ready', videoDetails.duration)
                this.removeProcessingVideo(cloudflareVideoId)

                console.log(`Video ${cloudflareVideoId} processing complete`)
            } else if (status.status === 'error') {
                // Video failed processing
                await this.updateVideoStatus(cloudflareVideoId, 'error')
                this.removeProcessingVideo(cloudflareVideoId)

                console.error(`Video ${cloudflareVideoId} processing failed:`, status.error)
            } else {
                // Still processing
                console.log(`Video ${cloudflareVideoId} still processing... Status: ${status.status}`)
            }
        } catch (error) {
            console.error(`Failed to check video ${cloudflareVideoId}:`, error)

            // If we can't check the status multiple times, assume it's an error
            // This prevents videos from being stuck in processing forever
            if (this.shouldMarkAsError()) {
                await this.updateVideoStatus(cloudflareVideoId, 'error')
                this.removeProcessingVideo(cloudflareVideoId)
            }
        }
    }

    /**
     * Update video status in database via API
     */
    private async updateVideoStatus(cloudflareVideoId: string, status: 'ready' | 'error', duration?: number) {
        try {
            interface UpdateData {
                processing_status: 'ready' | 'error';
                duration_seconds?: number;
                is_published?: boolean;
            }

            const updateData: UpdateData = {
                processing_status: status
            }

            if (duration) {
                updateData.duration_seconds = Math.round(duration)
            }

            if (status === 'ready') {
                updateData.is_published = true // Auto-publish when ready
            }

            const response = await fetch('/api/video-processing/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cloudflareVideoId,
                    updateData
                })
            })

            if (!response.ok) {
                throw new Error(`Failed to update video status: ${response.statusText}`)
            }

            console.log(`Updated video ${cloudflareVideoId} status to ${status}`)
        } catch (error) {
            console.error(`Failed to update video status for ${cloudflareVideoId}:`, error)
            throw error
        }
    }

    /**
     * Check if we should mark a video as error due to repeated failures
     */
    private shouldMarkAsError(): boolean {
        // For now, keep trying indefinitely
        // In production, you might want to implement retry limits
        return false
    }

    /**
     * Get currently processing videos
     */
    getProcessingVideos(): Set<string> {
        return new Set(this.processingVideos)
    }

    /**
     * Initialize processing videos from database
     * Call this on service start to resume monitoring existing processing videos
     */
    async initializeFromDatabase() {
        try {
            const response = await fetch('/api/video-processing/get-processing', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            // Check if response is JSON before parsing
            const contentType = response.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('Video processing service: API returned non-JSON response, skipping initialization')
                return
            }

            if (response.ok) {
                const { processingVideos } = await response.json()

                for (const video of processingVideos) {
                    if (video.cloudflare_video_id) {
                        this.addProcessingVideo(video.cloudflare_video_id)
                    }
                }

                console.log(`Initialized ${processingVideos.length} processing videos from database`)
            } else {
                console.warn(`Video processing service: API returned ${response.status}, skipping initialization`)
            }
        } catch (error) {
            console.error('Failed to initialize processing videos from database:', error)
        }
    }
}

// Create singleton instance
export const videoProcessingService = new VideoProcessingService()

// Auto-start the service when the module loads (server-side only)
// Note: This service should only run on the server-side, not in the browser
// Client-side components should use API calls to trigger processing updates
if (typeof window === 'undefined') {
    // Start after a delay to ensure the environment is initialized
    setTimeout(() => {
        videoProcessingService.initializeFromDatabase().then(() => {
            videoProcessingService.start()
        })
    }, 2000)
}

export default videoProcessingService