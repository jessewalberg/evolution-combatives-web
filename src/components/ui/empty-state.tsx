/**
 * Evolution Combatives Empty State Component System
 * Professional empty state displays for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Empty state component system with contextual messaging and CTAs
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Button } from './button'
import {
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    PlayIcon,
    UsersIcon,
    DocumentTextIcon,
    ChartBarIcon,
    WifiIcon,
    ServerIcon,
    ShieldCheckIcon,
    PlusIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline'

/**
 * Empty state variants using class-variance-authority
 */
const emptyStateVariants = cva(
    [
        'flex flex-col items-center justify-center text-center p-8',
        'min-h-64',
    ],
    {
        variants: {
            variant: {
                // Default - General empty state
                default: '',

                // No data - When there's simply no content
                'no-data': '',

                // No results - When search/filter returns nothing
                'no-results': '',

                // Error - When something went wrong
                error: '',

                // Offline/Connection issues
                offline: '',

                // Coming soon / Under construction
                'coming-soon': '',
            },
            size: {
                sm: 'min-h-32 p-4',
                md: 'min-h-48 p-6',
                lg: 'min-h-64 p-8',
                xl: 'min-h-80 p-12',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'lg',
        },
    }
)

/**
 * Icon container variants
 */
const iconVariants = cva(
    [
        'flex items-center justify-center rounded-full mb-4',
        'text-neutral-400',
    ],
    {
        variants: {
            variant: {
                default: 'bg-neutral-800 text-neutral-400',
                error: 'bg-error-500/20 text-error-400',
                warning: 'bg-warning-500/20 text-warning-400',
                info: 'bg-info-500/20 text-info-400',
                success: 'bg-success-500/20 text-success-400',
            },
            size: {
                sm: 'h-12 w-12',
                md: 'h-16 w-16',
                lg: 'h-20 w-20',
                xl: 'h-24 w-24',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'lg',
        },
    }
)

/**
 * Empty state action interface
 */
export interface EmptyStateAction {
    /** Action label */
    label: string
    /** Click handler */
    onClick: () => void
    /** Button variant */
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    /** Button size */
    size?: 'sm' | 'lg' | 'xl' | 'xs' | 'icon'
    /** Icon component */
    icon?: React.ComponentType<{ className?: string }>
    /** Loading state */
    loading?: boolean
}

/**
 * Empty state component props
 */
export interface EmptyStateProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
    /**
     * Icon to display
     */
    icon?: React.ComponentType<{ className?: string }>

    /**
     * Title text
     */
    title: string

    /**
     * Description text
     */
    description?: string

    /**
     * Primary action
     */
    primaryAction?: EmptyStateAction

    /**
     * Secondary action
     */
    secondaryAction?: EmptyStateAction

    /**
     * Additional actions
     */
    actions?: EmptyStateAction[]

    /**
     * Icon variant for styling
     */
    iconVariant?: VariantProps<typeof iconVariants>['variant']

    /**
     * Icon size
     */
    iconSize?: VariantProps<typeof iconVariants>['size']

    /**
     * Custom illustration or image
     */
    illustration?: React.ReactNode

    /**
     * Whether to show tactical branding
     */
    showBranding?: boolean
}

/**
 * Professional Empty State Component
 * 
 * @example
 * ```tsx
 * // No videos empty state
 * <EmptyState
 *   icon={PlayIcon}
 *   title="No videos uploaded yet"
 *   description="Start building your tactical training library by uploading your first video."
 *   primaryAction={{
 *     label: "Upload Video",
 *     onClick: () => handleUpload(),
 *     icon: PlusIcon
 *   }}
 *   secondaryAction={{
 *     label: "Browse Templates",
 *     onClick: () => handleBrowse(),
 *     variant: "outline"
 *   }}
 * />
 * ```
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
    ({
        className,
        variant,
        size,
        icon: IconComponent,
        title,
        description,
        primaryAction,
        secondaryAction,
        actions = [],
        iconVariant = 'default',
        iconSize,
        illustration,
        showBranding = false,
        ...props
    }, ref) => {
        const allActions = [
            ...(primaryAction ? [primaryAction] : []),
            ...(secondaryAction ? [secondaryAction] : []),
            ...actions,
        ]

        const effectiveIconSize = iconSize || (size === 'sm' ? 'sm' : size === 'xl' ? 'xl' : 'lg')

        return (
            <div
                ref={ref}
                className={cn(emptyStateVariants({ variant, size }), className)}
                {...props}
            >
                {/* Illustration or Icon */}
                {illustration ? (
                    <div className="mb-6">
                        {illustration}
                    </div>
                ) : IconComponent ? (
                    <div className={cn(iconVariants({ variant: iconVariant, size: effectiveIconSize }))}>
                        <IconComponent className="h-8 w-8" />
                    </div>
                ) : null}

                {/* Content */}
                <div className="max-w-md space-y-3">
                    <h3 className={cn(
                        'font-semibold text-neutral-0',
                        size === 'sm' && 'text-lg',
                        size === 'md' && 'text-xl',
                        size === 'lg' && 'text-2xl',
                        size === 'xl' && 'text-3xl'
                    )}>
                        {title}
                    </h3>

                    {description && (
                        <p className={cn(
                            'text-neutral-400 leading-relaxed',
                            size === 'sm' && 'text-sm',
                            size === 'md' && 'text-base',
                            size === 'lg' && 'text-base',
                            size === 'xl' && 'text-lg'
                        )}>
                            {description}
                        </p>
                    )}
                </div>

                {/* Actions */}
                {allActions.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        {allActions.map((action, index) => (
                            <Button
                                key={index}
                                variant={action.variant || (index === 0 ? 'primary' : 'outline')}
                                size={action.size || 'lg'}
                                onClick={action.onClick}
                                disabled={action.loading}
                                loading={action.loading}
                                leftIcon={action.icon && !action.loading ? <action.icon className="h-4 w-4" /> : undefined}
                                className="min-w-32"
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Tactical Branding */}
                {showBranding && (
                    <div className="mt-8 pt-8 border-t border-neutral-700">
                        <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm">
                            <ShieldCheckIcon className="h-4 w-4" />
                            <span>Evolution Combatives Professional Platform</span>
                        </div>
                    </div>
                )}
            </div>
        )
    }
)

EmptyState.displayName = 'EmptyState'

/**
 * Predefined empty state components for common scenarios
 */

/**
 * No Videos Empty State
 */
const NoVideosEmptyState: React.FC<{
    onUpload?: () => void
    onBrowse?: () => void
    className?: string
}> = ({ onUpload, onBrowse, className }) => (
    <EmptyState
        className={className}
        icon={PlayIcon}
        title="No videos uploaded yet"
        description="Start building your tactical training library by uploading your first video content."
        primaryAction={onUpload ? {
            label: "Upload Video",
            onClick: onUpload,
            icon: PlusIcon,
        } : undefined}
        secondaryAction={onBrowse ? {
            label: "Browse Templates",
            onClick: onBrowse,
            variant: "outline",
        } : undefined}
        iconVariant="info"
    />
)

/**
 * No Users Empty State
 */
const NoUsersEmptyState: React.FC<{
    onInvite?: () => void
    onImport?: () => void
    className?: string
}> = ({ onInvite, onImport, className }) => (
    <EmptyState
        className={className}
        icon={UsersIcon}
        title="No users found"
        description="Your platform is ready for users. Start by inviting team members or importing existing user data."
        primaryAction={onInvite ? {
            label: "Invite Users",
            onClick: onInvite,
            icon: PlusIcon,
        } : undefined}
        secondaryAction={onImport ? {
            label: "Import Data",
            onClick: onImport,
            variant: "outline",
        } : undefined}
        iconVariant="info"
    />
)

/**
 * No Search Results Empty State
 */
const NoSearchResultsEmptyState: React.FC<{
    searchQuery?: string
    onClearSearch?: () => void
    onRetry?: () => void
    className?: string
}> = ({ searchQuery, onClearSearch, onRetry, className }) => (
    <EmptyState
        className={className}
        icon={MagnifyingGlassIcon}
        title="No results found"
        description={
            searchQuery
                ? `No results found for "${searchQuery}". Try different keywords or check your spelling.`
                : "No results match your current filters. Try adjusting your search criteria."
        }
        primaryAction={onClearSearch ? {
            label: "Clear Search",
            onClick: onClearSearch,
            variant: "outline",
        } : undefined}
        secondaryAction={onRetry ? {
            label: "Try Again",
            onClick: onRetry,
            icon: ArrowPathIcon,
        } : undefined}
        size="md"
    />
)

/**
 * Error Empty State
 */
const ErrorEmptyState: React.FC<{
    title?: string
    description?: string
    onRetry?: () => void
    onContact?: () => void
    className?: string
}> = ({
    title = "Something went wrong",
    description = "We encountered an error while loading this content. Please try again or contact support.",
    onRetry,
    onContact,
    className
}) => (
        <EmptyState
            className={className}
            icon={ExclamationTriangleIcon}
            title={title}
            description={description}
            primaryAction={onRetry ? {
                label: "Try Again",
                onClick: onRetry,
                icon: ArrowPathIcon,
            } : undefined}
            secondaryAction={onContact ? {
                label: "Contact Support",
                onClick: onContact,
                variant: "outline",
            } : undefined}
            iconVariant="error"
        />
    )

/**
 * Offline Empty State
 */
const OfflineEmptyState: React.FC<{
    onRetry?: () => void
    className?: string
}> = ({ onRetry, className }) => (
    <EmptyState
        className={className}
        icon={WifiIcon}
        title="Connection lost"
        description="Unable to connect to the Evolution Combatives servers. Please check your internet connection and try again."
        primaryAction={onRetry ? {
            label: "Retry Connection",
            onClick: onRetry,
            icon: ArrowPathIcon,
        } : undefined}
        iconVariant="warning"
    />
)

/**
 * Maintenance Empty State
 */
const MaintenanceEmptyState: React.FC<{
    estimatedTime?: string
    onStatusPage?: () => void
    className?: string
}> = ({ estimatedTime, onStatusPage, className }) => (
    <EmptyState
        className={className}
        icon={ServerIcon}
        title="Scheduled Maintenance"
        description={
            estimatedTime
                ? `We're performing scheduled maintenance. Expected completion: ${estimatedTime}.`
                : "We're performing scheduled maintenance to improve your experience. Please check back soon."
        }
        primaryAction={onStatusPage ? {
            label: "Status Page",
            onClick: onStatusPage,
            variant: "outline",
        } : undefined}
        iconVariant="info"
        showBranding
    />
)

/**
 * Coming Soon Empty State
 */
const ComingSoonEmptyState: React.FC<{
    feature?: string
    description?: string
    onNotify?: () => void
    className?: string
}> = ({
    feature = "Feature",
    description = "This feature is currently in development and will be available soon.",
    onNotify,
    className
}) => (
        <EmptyState
            className={className}
            icon={DocumentTextIcon}
            title={`${feature} Coming Soon`}
            description={description}
            primaryAction={onNotify ? {
                label: "Notify Me",
                onClick: onNotify,
                variant: "outline",
            } : undefined}
            iconVariant="info"
        />
    )

/**
 * No Analytics Data Empty State
 */
const NoAnalyticsEmptyState: React.FC<{
    onRefresh?: () => void
    className?: string
}> = ({ onRefresh, className }) => (
    <EmptyState
        className={className}
        icon={ChartBarIcon}
        title="No analytics data available"
        description="Analytics data will appear here once users start engaging with your content. Check back after some user activity."
        primaryAction={onRefresh ? {
            label: "Refresh Data",
            onClick: onRefresh,
            icon: ArrowPathIcon,
            variant: "outline",
        } : undefined}
        iconVariant="info"
        size="md"
    />
)

// Export all components
export {
    EmptyState,
    NoVideosEmptyState,
    NoUsersEmptyState,
    NoSearchResultsEmptyState,
    ErrorEmptyState,
    OfflineEmptyState,
    MaintenanceEmptyState,
    ComingSoonEmptyState,
    NoAnalyticsEmptyState,
    emptyStateVariants,
    iconVariants,
}

export default EmptyState 