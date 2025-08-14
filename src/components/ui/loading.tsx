/**
 * Evolution Combatives Loading Component System
 * Professional loading states for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Loading component system with spinners, skeletons, and overlays
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Spinner variants using class-variance-authority
 */
const spinnerVariants = cva(
    [
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        'text-primary-500',
    ],
    {
        variants: {
            size: {
                xs: 'h-3 w-3',
                sm: 'h-4 w-4',
                md: 'h-6 w-6',
                lg: 'h-8 w-8',
                xl: 'h-12 w-12',
                '2xl': 'h-16 w-16',
            },
            variant: {
                primary: 'text-primary-500',
                secondary: 'text-neutral-400',
                success: 'text-success-500',
                warning: 'text-warning-500',
                error: 'text-error-500',
            }
        },
        defaultVariants: {
            size: 'md',
            variant: 'primary',
        },
    }
)

/**
 * Loading overlay variants
 */
const overlayVariants = cva(
    [
        'absolute inset-0 flex items-center justify-center',
        'bg-neutral-900/80 backdrop-blur-sm',
        'transition-opacity duration-200',
    ],
    {
        variants: {
            variant: {
                default: 'z-40',
                modal: 'z-50',
                page: 'z-30',
            }
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

/**
 * Skeleton variants
 */
const skeletonVariants = cva(
    [
        'animate-pulse bg-neutral-700 rounded',
    ],
    {
        variants: {
            variant: {
                text: 'h-4',
                heading: 'h-6',
                title: 'h-8',
                button: 'h-10',
                card: 'h-32',
                avatar: 'rounded-full',
                rectangle: 'rounded-md',
                circle: 'rounded-full',
            }
        },
        defaultVariants: {
            variant: 'text',
        },
    }
)

/**
 * Progress bar variants
 */
const progressVariants = cva(
    [
        'w-full bg-neutral-700 rounded-full overflow-hidden',
    ],
    {
        variants: {
            size: {
                xs: 'h-1',
                sm: 'h-2',
                md: 'h-3',
                lg: 'h-4',
            },
            variant: {
                primary: '[&>div]:bg-primary-500',
                success: '[&>div]:bg-success-500',
                warning: '[&>div]:bg-warning-500',
                error: '[&>div]:bg-error-500',
            }
        },
        defaultVariants: {
            size: 'md',
            variant: 'primary',
        },
    }
)

/**
 * Spinner component props
 */
export interface SpinnerProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
    /**
     * Loading text to display
     */
    label?: string
    /**
     * Whether to show the label
     */
    showLabel?: boolean
}

/**
 * Professional Spinner Component
 */
const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
    ({ className, size, variant, label, showLabel = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('flex items-center gap-2', className)}
                role="status"
                aria-label={label || 'Loading'}
                {...props}
            >
                <div className={cn(spinnerVariants({ size, variant }))} />
                {showLabel && label && (
                    <span className="text-sm text-neutral-300">{label}</span>
                )}
                <span className="sr-only">{label || 'Loading'}</span>
            </div>
        )
    }
)

Spinner.displayName = 'Spinner'

/**
 * Loading overlay component props
 */
export interface LoadingOverlayProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof overlayVariants> {
    /**
     * Whether the overlay is visible
     */
    isVisible: boolean
    /**
     * Loading message
     */
    message?: string
    /**
     * Spinner size
     */
    spinnerSize?: VariantProps<typeof spinnerVariants>['size']
    /**
     * Spinner variant
     */
    spinnerVariant?: VariantProps<typeof spinnerVariants>['variant']
}

/**
 * Loading Overlay Component
 */
const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
    ({
        className,
        variant,
        isVisible,
        message = 'Loading...',
        spinnerSize = 'lg',
        spinnerVariant = 'primary',
        ...props
    }, ref) => {
        if (!isVisible) return null

        return (
            <div
                ref={ref}
                className={cn(overlayVariants({ variant }), className)}
                {...props}
            >
                <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-neutral-800/90 backdrop-blur-sm border border-neutral-700">
                    <Spinner size={spinnerSize} variant={spinnerVariant} />
                    <span className="text-sm text-neutral-300 font-medium">
                        {message}
                    </span>
                </div>
            </div>
        )
    }
)

LoadingOverlay.displayName = 'LoadingOverlay'

/**
 * Skeleton component props
 */
export interface SkeletonProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
    /**
     * Custom width
     */
    width?: string | number
    /**
     * Custom height
     */
    height?: string | number
    /**
     * Number of lines for text skeletons
     */
    lines?: number
}

/**
 * Skeleton Component
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
    ({ className, variant, width, height, lines = 1, ...props }, ref) => {
        if (lines > 1) {
            return (
                <div ref={ref} className="space-y-2" {...props}>
                    {Array.from({ length: lines }).map((_, index) => (
                        <div
                            key={index}
                            className={cn(
                                skeletonVariants({ variant }),
                                index === lines - 1 && 'w-3/4', // Last line shorter
                                className
                            )}
                            style={{
                                width: index === lines - 1 ? undefined : width,
                                height,
                            }}
                        />
                    ))}
                </div>
            )
        }

        return (
            <div
                ref={ref}
                className={cn(skeletonVariants({ variant }), className)}
                style={{ width, height }}
                {...props}
            />
        )
    }
)

Skeleton.displayName = 'Skeleton'

/**
 * Progress bar component props
 */
export interface ProgressProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
    /**
     * Progress value (0-100)
     */
    value: number
    /**
     * Maximum value
     */
    max?: number
    /**
     * Whether to show percentage text
     */
    showValue?: boolean
    /**
     * Custom label
     */
    label?: string
    /**
     * Whether progress is indeterminate
     */
    indeterminate?: boolean
}

/**
 * Progress Bar Component
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({
        className,
        size,
        variant,
        value,
        max = 100,
        showValue = false,
        label,
        indeterminate = false,
        ...props
    }, ref) => {
        const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

        return (
            <div ref={ref} className="w-full" {...props}>
                {(label || showValue) && (
                    <div className="flex justify-between items-center mb-2">
                        {label && (
                            <span className="text-sm font-medium text-neutral-300">
                                {label}
                            </span>
                        )}
                        {showValue && (
                            <span className="text-sm text-neutral-400">
                                {Math.round(percentage)}%
                            </span>
                        )}
                    </div>
                )}
                <div className={cn(progressVariants({ size, variant }), className)}>
                    <div
                        className={cn(
                            'h-full transition-all duration-300 ease-out',
                            indeterminate && 'animate-pulse'
                        )}
                        style={{
                            width: indeterminate ? '100%' : `${percentage}%`,
                        }}
                        role="progressbar"
                        aria-valuenow={value}
                        aria-valuemax={max}
                        aria-label={label}
                    />
                </div>
            </div>
        )
    }
)

Progress.displayName = 'Progress'

/**
 * Specialized skeleton components for common patterns
 */

/**
 * Table skeleton
 */
export interface TableSkeletonProps {
    rows?: number
    columns?: number
    showHeader?: boolean
    className?: string
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
    rows = 5,
    columns = 4,
    showHeader = true,
    className
}) => {
    return (
        <div className={cn('space-y-4', className)}>
            {showHeader && (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                    {Array.from({ length: columns }).map((_, index) => (
                        <Skeleton key={index} variant="text" className="h-5" />
                    ))}
                </div>
            )}
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div
                        key={rowIndex}
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                    >
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton key={colIndex} variant="text" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

TableSkeleton.displayName = 'TableSkeleton'

/**
 * Card skeleton
 */
export interface CardSkeletonProps {
    showAvatar?: boolean
    showImage?: boolean
    lines?: number
    className?: string
}

const CardSkeleton: React.FC<CardSkeletonProps> = ({
    showAvatar = false,
    showImage = false,
    lines = 3,
    className
}) => {
    return (
        <div className={cn('p-6 space-y-4', className)}>
            {showImage && (
                <Skeleton variant="rectangle" className="h-32 w-full" />
            )}
            <div className="space-y-3">
                {showAvatar && (
                    <div className="flex items-center gap-3">
                        <Skeleton variant="avatar" className="h-10 w-10" />
                        <div className="space-y-2 flex-1">
                            <Skeleton variant="text" className="w-1/3" />
                            <Skeleton variant="text" className="w-1/4" />
                        </div>
                    </div>
                )}
                <Skeleton variant="heading" className="w-2/3" />
                <Skeleton variant="text" lines={lines} />
                <div className="flex gap-2 pt-2">
                    <Skeleton variant="button" className="w-20" />
                    <Skeleton variant="button" className="w-16" />
                </div>
            </div>
        </div>
    )
}

CardSkeleton.displayName = 'CardSkeleton'

/**
 * Video grid skeleton
 */
export interface VideoGridSkeletonProps {
    count?: number
    columns?: number
    className?: string
}

const VideoGridSkeleton: React.FC<VideoGridSkeletonProps> = ({
    count = 6,
    columns = 3,
    className
}) => {
    return (
        <div
            className={cn(
                'grid gap-6',
                columns === 2 && 'grid-cols-1 md:grid-cols-2',
                columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                className
            )}
        >
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="space-y-3">
                    <Skeleton variant="rectangle" className="h-32 w-full" />
                    <Skeleton variant="heading" className="w-3/4" />
                    <Skeleton variant="text" className="w-1/2" />
                    <div className="flex items-center gap-2">
                        <Skeleton variant="avatar" className="h-6 w-6" />
                        <Skeleton variant="text" className="w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}

VideoGridSkeleton.displayName = 'VideoGridSkeleton'

/**
 * Loading Button Component
 */
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean
    loadingText?: string
    spinnerSize?: VariantProps<typeof spinnerVariants>['size']
    children: React.ReactNode
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    ({
        isLoading = false,
        loadingText,
        spinnerSize = 'sm',
        children,
        disabled,
        className,
        ...props
    }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    'relative inline-flex items-center justify-center gap-2',
                    'px-4 py-2 rounded-md font-medium transition-colors',
                    'bg-primary-600 text-white hover:bg-primary-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    className
                )}
                {...props}
            >
                {isLoading && (
                    <Spinner size={spinnerSize} variant="secondary" />
                )}
                <span className={cn(isLoading && 'opacity-70')}>
                    {isLoading && loadingText ? loadingText : children}
                </span>
            </button>
        )
    }
)

LoadingButton.displayName = 'LoadingButton'

// Export all components
export {
    Spinner,
    LoadingOverlay,
    Skeleton,
    Progress,
    TableSkeleton,
    CardSkeleton,
    VideoGridSkeleton,
    LoadingButton,
    spinnerVariants,
    overlayVariants,
    skeletonVariants,
    progressVariants,
}

export default Spinner 