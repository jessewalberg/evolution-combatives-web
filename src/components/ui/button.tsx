/**
 * Evolution Combatives Button Component
 * Professional button component for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Button component matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Loading spinner component for button loading states
 */
const LoadingSpinner = ({ className }: { className?: string }) => (
    <svg
        className={cn('animate-spin', className)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
    >
        <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
        />
        <path
            className="opacity-75"
            fill="currentColor"
            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
    </svg>
)

/**
 * Button variants using class-variance-authority
 * Matches Evolution Combatives tactical design system
 */
const buttonVariants = cva(
    // Base styles - consistent across all variants
    [
        'inline-flex items-center justify-center gap-2',
        'rounded-md text-sm font-semibold',
        'transition-all duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:scale-[0.98]',
        'select-none'
    ],
    {
        variants: {
            variant: {
                // Primary - Main brand blue for primary actions
                primary: [
                    'bg-blue-600 text-white border border-blue-600',
                    'hover:bg-blue-700 hover:border-blue-700',
                    'hover:shadow-lg hover:-translate-y-0.5',
                    'active:bg-blue-800 active:translate-y-0',
                    'disabled:bg-gray-400 disabled:border-gray-400'
                ],

                // Secondary - Neutral gray for secondary actions
                secondary: [
                    'bg-gray-600 text-white border border-gray-600',
                    'hover:bg-gray-700 hover:border-gray-700',
                    'hover:shadow-lg hover:-translate-y-0.5',
                    'active:bg-gray-800 active:translate-y-0',
                    'disabled:bg-gray-400 disabled:border-gray-400'
                ],

                // Outline - Border only with hover fill
                outline: [
                    'bg-transparent text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600',
                    'hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500',
                    'hover:shadow-sm hover:-translate-y-0.5',
                    'active:bg-gray-100 dark:active:bg-gray-800 active:translate-y-0',
                    'disabled:text-gray-400 disabled:border-gray-300'
                ],

                // Ghost - Minimal styling with hover background
                ghost: [
                    'bg-transparent text-gray-900 dark:text-white border border-transparent',
                    'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
                    'hover:shadow-sm',
                    'active:bg-gray-200 dark:active:bg-gray-700',
                    'disabled:text-gray-400'
                ],

                // Destructive - Red for dangerous actions
                destructive: [
                    'bg-red-600 text-white border border-red-600',
                    'hover:bg-red-700 hover:border-red-700',
                    'hover:shadow-lg hover:-translate-y-0.5',
                    'active:bg-red-800 active:translate-y-0',
                    'disabled:bg-gray-400 disabled:border-gray-400'
                ],

                // Success - Green for positive actions
                success: [
                    'bg-green-600 text-white border border-green-600',
                    'hover:bg-green-700 hover:border-green-700',
                    'hover:shadow-lg hover:-translate-y-0.5',
                    'active:bg-green-800 active:translate-y-0',
                    'disabled:bg-gray-400 disabled:border-gray-400'
                ],

                // Warning - Orange for warning actions
                warning: [
                    'bg-yellow-600 text-white border border-yellow-600',
                    'hover:bg-yellow-700 hover:border-yellow-700',
                    'hover:shadow-lg hover:-translate-y-0.5',
                    'active:bg-yellow-800 active:translate-y-0',
                    'disabled:bg-gray-400 disabled:border-gray-400'
                ]
            },

            size: {
                // Extra small - 28px height
                xs: 'h-7 px-2 text-xs gap-1',

                // Small - 32px height
                sm: 'h-8 px-3 text-xs gap-1.5',

                // Default - 40px height (matches mobile app)
                default: 'h-10 px-4 text-sm gap-2',

                // Large - 48px height
                lg: 'h-12 px-6 text-base gap-2',

                // Extra large - 56px height
                xl: 'h-14 px-8 text-lg gap-3',

                // Icon button - 40x40px square
                icon: 'h-10 w-10 p-0'
            }
        },
        defaultVariants: {
            variant: 'primary',
            size: 'default'
        }
    }
)

/**
 * Button component props interface
 */
export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    /**
     * Render as a different element (useful for links)
     */
    asChild?: boolean

    /**
     * Loading state - shows spinner and disables interaction
     */
    loading?: boolean

    /**
     * Loading text to show when loading (optional)
     */
    loadingText?: string

    /**
     * Icon to show before text (when not loading)
     */
    leftIcon?: React.ReactNode

    /**
     * Icon to show after text (when not loading)
     */
    rightIcon?: React.ReactNode
}

/**
 * Professional Button Component
 * 
 * @example
 * ```tsx
 * // Primary button with loading state
 * <Button variant="primary" size="lg" loading={isUploading}>
 *   Upload Video
 * </Button>
 * 
 * // Icon button
 * <Button variant="outline" size="icon">
 *   <PlusIcon className="h-4 w-4" />
 * </Button>
 * 
 * // Button with icons
 * <Button 
 *   variant="secondary" 
 *   leftIcon={<DownloadIcon className="h-4 w-4" />}
 *   rightIcon={<ExternalLinkIcon className="h-4 w-4" />}
 * >
 *   Export Data
 * </Button>
 * 
 * // Destructive action
 * <Button variant="destructive" loading={isDeleting} loadingText="Deleting...">
 *   Delete Video
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            loading = false,
            loadingText,
            leftIcon,
            rightIcon,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button'

        // Determine if button should be disabled
        const isDisabled = disabled || loading

        // Determine what content to show
        const showSpinner = loading
        const showLeftIcon = leftIcon && !loading
        const showRightIcon = rightIcon && !loading
        const buttonText = loading && loadingText ? loadingText : children

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isDisabled}
                {...props}
            >
                {/* Loading spinner */}
                {showSpinner && (
                    <LoadingSpinner className="h-4 w-4 shrink-0" />
                )}

                {/* Left icon */}
                {showLeftIcon && (
                    <span className="shrink-0">
                        {leftIcon}
                    </span>
                )}

                {/* Button text */}
                {buttonText && (
                    <span className={cn(
                        'truncate',
                        // Hide text in icon-only buttons unless loading with loadingText
                        size === 'icon' && !(loading && loadingText) && 'sr-only'
                    )}>
                        {buttonText}
                    </span>
                )}

                {/* Right icon */}
                {showRightIcon && (
                    <span className="shrink-0">
                        {rightIcon}
                    </span>
                )}
            </Comp>
        )
    }
)

Button.displayName = 'Button'

export { Button, buttonVariants } 