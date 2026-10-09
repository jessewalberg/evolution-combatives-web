/**
 * Shared next/image mock for component tests.
 * Use with: vi.mock('next/image', async () => {
 *   const { createNextImageMock } = await import('@/test/mocks/next-image')
 *   return createNextImageMock()
 * })
 */

import * as React from 'react'

export type NextImageMockProps = {
  src: string
  alt: string
  onLoad?: React.ReactEventHandler<HTMLImageElement>
  onError?: React.ReactEventHandler<HTMLImageElement>
  fill?: boolean
  className?: string
  sizes?: string
} & Record<string, unknown>

/**
 * Drop-in replacement for next/image that renders a plain img in jsdom.
 */
export function NextImageMock({
  src,
  alt,
  onLoad,
  onError,
  fill: _fill,
  sizes: _sizes,
  ...props
}: NextImageMockProps) {
  return (
    <img
      src={src}
      alt={alt}
      data-testid="next-image"
      onLoad={onLoad}
      onError={onError}
      {...props}
    />
  )
}

/**
 * Vitest-compatible module shape for vi.mock('next/image', ...).
 */
export function createNextImageMock() {
  return {
    __esModule: true as const,
    default: NextImageMock,
  }
}
