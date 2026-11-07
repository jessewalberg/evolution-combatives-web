import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Image from '@/src/components/compat/image'
import { cloudflareApi } from '@/src/lib/cloudflare-api'
import { queueThumbnailRequest } from '@/src/lib/thumbnail-request-queue'

const TOKEN_LIFETIME_MS = 60 * 60 * 1000
const REFRESH_MS = 50 * 60 * 1000
const RETRY_MS = 60 * 1000

export function useSignedStreamThumbnail(videoId: string | null | undefined): string | null {
    const { data, dataUpdatedAt } = useQuery({
        queryKey: ['signed-stream-thumbnail', videoId],
        queryFn: ({ signal }) => queueThumbnailRequest(signal, () => cloudflareApi.generateThumbnailUrl(videoId!)),
        enabled: typeof window !== 'undefined' && !!videoId,
        staleTime: REFRESH_MS,
        retry: false,
        refetchInterval: (query) => {
            const { dataUpdatedAt, errorUpdatedAt } = query.state
            if (errorUpdatedAt > dataUpdatedAt) {
                return Math.max(1_000, errorUpdatedAt + RETRY_MS - Date.now())
            }
            return dataUpdatedAt ? Math.max(1_000, dataUpdatedAt + REFRESH_MS - Date.now()) : false
        },
    })

    return data && Date.now() - dataUpdatedAt < TOKEN_LIFETIME_MS ? data : null
}

export function SignedStreamThumbnail({
    videoId,
    alt,
    width,
    height,
    className,
    fallback,
}: {
    videoId: string | null | undefined
    alt: string
    width: number
    height: number
    className?: string
    fallback?: ReactNode
}) {
    const url = useSignedStreamThumbnail(videoId)
    return url
        ? <Image src={url} alt={alt} width={width} height={height} className={className} />
        : fallback ?? null
}
