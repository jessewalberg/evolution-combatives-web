/**
 * next/image compat shim rendering a plain <img>. There is no image
 * optimization pipeline on the Worker; Cloudflare Stream thumbnails and
 * avatars are already CDN-served at sensible sizes.
 */

import * as React from 'react'

type ImageProps = Omit<React.ComponentPropsWithoutRef<'img'>, 'src'> & {
    src: string
    alt: string
    fill?: boolean
    priority?: boolean
    quality?: number
    sizes?: string
    unoptimized?: boolean
    placeholder?: string
    blurDataURL?: string
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(function Image(
    {
        src,
        alt,
        fill,
        priority,
        quality: _quality,
        unoptimized: _unoptimized,
        placeholder: _placeholder,
        blurDataURL: _blurDataURL,
        style,
        loading,
        ...rest
    },
    ref,
) {
    const fillStyle: React.CSSProperties | undefined = fill
        ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
        : undefined

    return (
        <img
            ref={ref}
            src={src}
            alt={alt}
            loading={priority ? 'eager' : (loading ?? 'lazy')}
            style={{ ...fillStyle, ...style }}
            {...rest}
        />
    )
})

export default Image
