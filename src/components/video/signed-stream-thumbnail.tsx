import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Image from '@/src/components/compat/image'
import { cloudflareApi } from '@/src/lib/cloudflare-api'

const TOKEN_LIFETIME_MS = 60 * 60 * 1000
const REFRESH_MS = 50 * 60 * 1000

export function useSignedStreamThumbnail(videoId: string | null | undefined): string | null {
    const { data, dataUpdatedAt } = useQuery({
        queryKey: ['signed-stream-thumbnail', videoId],
        queryFn: () => cloudflareApi.generateThumbnailUrl(videoId!),
        enabled: !!videoId,
        staleTime: REFRESH_MS,
        refetchInterval: (query) => {
            const updatedAt = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt)
            return updatedAt ? Math.max(1_000, updatedAt + REFRESH_MS - Date.now()) : false
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
