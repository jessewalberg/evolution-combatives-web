import { useEffect, useState } from 'react'
import { queueThumbnailRequest } from '@/src/lib/thumbnail-request-queue'

export function QaVideoThumbnail({ videoId, alt, className, width, height }: {
    videoId: string
    alt: string
    className?: string
    width?: number
    height?: number
}) {
    const [url, setUrl] = useState<string>()

    useEffect(() => {
        const controller = new AbortController()
        let objectUrl: string | undefined
        setUrl(undefined)
        void queueThumbnailRequest(controller.signal, async () => {
            const response = await fetch(`/api/qa-video-thumbnail?videoId=${encodeURIComponent(videoId)}`, {
                signal: controller.signal,
            })
            if (!response.ok) throw new Error('Thumbnail request failed')
            return response.blob()
        }).then((blob) => {
            if (controller.signal.aborted) return
            objectUrl = URL.createObjectURL(blob)
            setUrl(objectUrl)
        }).catch(() => {
            // The thumbnail is optional; retain the empty placeholder on failure.
        })
        return () => {
            controller.abort()
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [videoId])

    return url ? <img src={url} alt={alt} className={className} width={width} height={height} /> : null
}
