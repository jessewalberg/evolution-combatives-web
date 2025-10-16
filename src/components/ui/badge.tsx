/**
 * Evolution Combatives Badge Component System
 * Professional badge components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Badge component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { componentClasses } from '../../theme';

const badgeVariants = cva(
    componentClasses.badge.base,
    {
        variants: {
            variant: {
                default: componentClasses.badge.default,
                primary: componentClasses.badge.primary,
                secondary: componentClasses.badge.secondary,
                success: componentClasses.badge.success,
                warning: componentClasses.badge.warning,
                error: componentClasses.badge.error,
                info: componentClasses.badge.info,
                gold: componentClasses.badge.gold,
            },

            appearance: {
                // Solid - Filled background (default)
                solid: '',

                // Outline - Border only with transparent background
                outline: [
                    'bg-transparent border-2'
                ],

                // Soft - Subtle background with stronger text
                soft: [
                    'border-transparent'
                ]
            },

            size: {
                // Extra small - Compact badges
                xs: 'px-2 py-0.5 text-xs gap-1',

                // Small - Default size
                sm: 'px-2.5 py-1 text-xs gap-1.5',

                // Medium - Slightly larger
                md: 'px-3 py-1.5 text-sm gap-2',

                // Large - Prominent badges
                lg: 'px-4 py-2 text-sm gap-2'
            }
        },
        defaultVariants: {
            variant: 'default',
            appearance: 'solid',
            size: 'sm'
        }
    }
)

/**
 * Badge component props interface
 */
export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    /**
     * Icon to display before the text
     */
    icon?: React.ReactNode

    /**
     * Whether the badge is interactive (clickable)
     */
    interactive?: boolean

    /**
     * Click handler for interactive badges
     */
    onBadgeClick?: () => void
}

/**
 * Professional Badge Component
 */
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({
        className,
        variant,
        appearance,
        size,
        icon,
        interactive,
        onBadgeClick,
        children,
        onClick,
        ...props
    }, ref) => {
        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
            onClick?.(event)
            onBadgeClick?.()
        }

        // Apply appearance-specific overrides
        let appearanceClasses = ''
        if (appearance === 'outline') {
            switch (variant) {
                case 'primary':
                    appearanceClasses = 'bg-transparent text-primary border-primary'
                    break
                case 'success':
                    appearanceClasses = 'bg-transparent text-green-600 dark:text-green-400 border-green-600 dark:border-green-400'
                    break
                case 'warning':
                    appearanceClasses = 'bg-transparent text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400'
                    break
                case 'error':
                    appearanceClasses = 'bg-transparent text-destructive border-destructive'
                    break
                case 'info':
                    appearanceClasses = 'bg-transparent text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                    break
                default:
                    appearanceClasses = 'bg-transparent text-muted-foreground border-border'
            }
        } else if (appearance === 'soft') {
            switch (variant) {
                case 'primary':
                    appearanceClasses = 'bg-primary/20 text-primary'
                    break
                case 'success':
                    appearanceClasses = 'bg-green-600/20 dark:bg-green-700/20 text-green-700 dark:text-green-300'
                    break
                case 'warning':
                    appearanceClasses = 'bg-yellow-600/20 dark:bg-yellow-700/20 text-yellow-700 dark:text-yellow-300'
                    break
                case 'error':
                    appearanceClasses = 'bg-destructive/20 text-destructive'
                    break
                case 'info':
                    appearanceClasses = 'bg-blue-600/20 dark:bg-blue-700/20 text-blue-700 dark:text-blue-300'
                    break
                default:
                    appearanceClasses = 'bg-muted/20 text-muted-foreground'
            }
        }

        return (
            <div
                ref={ref}
                className={cn(
                    badgeVariants({ variant, appearance, size }),
                    appearanceClasses,
                    interactive && 'cursor-pointer hover:scale-105 active:scale-95',
                    className
                )}
                onClick={interactive || onBadgeClick ? handleClick : onClick}
                {...props}
            >
                {icon && <span className="flex-shrink-0">{icon}</span>}
                {children}
            </div>
        )
    }
)
Badge.displayName = 'Badge'

// ============================================================================
// HEROICONS COMPONENTS
// ============================================================================

/**
 * Heroicons components for badge icons
 */
const HeroIcons = {
    // Admin roles
    ShieldCheck: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    ),

    Cog6Tooth: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 0a3 3 0 006.364 0M12 21a9 9 0 100-18 9 9 0 000 18zm0 0a8.949 8.949 0 01-4.951-1.488A3.987 3.987 0 019 18.75h6a3.987 3.987 0 012.951 1.262A8.949 8.949 0 0112 21z" />
        </svg>
    ),

    LifeBuoy: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-3.448a1.5 1.5 0 010 2.12m0-2.12a1.5 1.5 0 00-2.12 0m2.12 0l-2.879 2.879m2.879-2.879l2.879-2.879m0 0a9.027 9.027 0 001.306-1.652M4.33 16.712a9.027 9.027 0 01-1.306-1.652M4.33 16.712l4.138-3.448m-4.138 3.448a9.014 9.014 0 000-9.424m4.138 3.448a1.5 1.5 0 000-2.12m0 2.12a1.5 1.5 0 002.12 0m-2.12 0l2.879-2.879m-2.879 2.879l-2.879 2.879m0 0a9.027 9.027 0 01-1.306 1.652" />
        </svg>
    ),

    // Status icons
    CheckCircle: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),

    XCircle: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),

    ExclamationTriangle: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
    ),

    Clock: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),

    DocumentText: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    ),

    // Subscription icons
    Star: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
    ),

    Trophy: ({ className }: { className?: string }) => (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25H16.5v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" clipRule="evenodd" />
        </svg>
    ),

    MinusCircle: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    )
}

// ============================================================================
// SPECIALIZED BADGE COMPONENTS
// ============================================================================

/**
 * Subscription Tier Badge
 */
export interface SubscriptionBadgeProps extends Omit<BadgeProps, 'variant' | 'icon'> {
    tier: 'none' | 'tier1' | 'tier2' | 'tier3'
}

const SubscriptionBadge = React.forwardRef<HTMLDivElement, SubscriptionBadgeProps>(
    ({ tier, ...props }, ref) => {
        const config = {
            none: {
                variant: 'secondary' as const,
                icon: <HeroIcons.MinusCircle className="h-2.5 w-2.5" />,
                text: 'Free'
            },
            tier1: {
                variant: 'info' as const,
                icon: <HeroIcons.Star className="h-2.5 w-2.5" />,
                text: 'T1'
            },
            tier2: {
                variant: 'primary' as const,
                icon: <HeroIcons.Trophy className="h-2.5 w-2.5" />,
                text: 'T2'
            },
            tier3: {
                variant: 'gold' as const,
                icon: <HeroIcons.Trophy className="h-2.5 w-2.5" />,
                text: 'T3'
            }
        }

        const { variant, icon, text } = config[tier]

        return (
            <Badge
                ref={ref}
                variant={variant}
                icon={icon}
                {...props}
            >
                {text}
            </Badge>
        )
    }
)
SubscriptionBadge.displayName = 'SubscriptionBadge'

/**
 * Admin Role Badge
 */
export interface AdminRoleBadgeProps extends Omit<BadgeProps, 'variant' | 'icon'> {
    role: 'super_admin' | 'content_admin' | 'support_admin' | 'user'
}

const AdminRoleBadge = React.forwardRef<HTMLDivElement, AdminRoleBadgeProps>(
    ({ role, ...props }, ref) => {
        const config = {
            super_admin: {
                variant: 'error' as const,
                icon: <HeroIcons.ShieldCheck className="h-3 w-3" />,
                text: 'Super Admin'
            },
            content_admin: {
                variant: 'primary' as const,
                icon: <HeroIcons.Cog6Tooth className="h-3 w-3" />,
                text: 'Content Admin'
            },
            support_admin: {
                variant: 'success' as const,
                icon: <HeroIcons.LifeBuoy className="h-3 w-3" />,
                text: 'Support Admin'
            },
            user: {
                variant: 'secondary' as const,
                icon: null,
                text: 'User'
            }
        }

        const { variant, icon, text } = config[role]

        return (
            <Badge
                ref={ref}
                variant={variant}
                icon={icon}
                {...props}
            >
                {text}
            </Badge>
        )
    }
)
AdminRoleBadge.displayName = 'AdminRoleBadge'

/**
 * Video Status Badge
 */
export interface VideoStatusBadgeProps extends Omit<BadgeProps, 'variant' | 'icon'> {
    status: 'processing' | 'ready' | 'error' | 'draft' | 'uploaded' | 'archived'
}

const VideoStatusBadge = React.forwardRef<HTMLDivElement, VideoStatusBadgeProps>(
    ({ status, ...props }, ref) => {
        const config = {
            processing: {
                variant: 'warning' as const,
                icon: <HeroIcons.Clock className="h-2.5 w-2.5" />,
                text: 'Processing'
            },
            ready: {
                variant: 'success' as const,
                icon: <HeroIcons.CheckCircle className="h-2.5 w-2.5" />,
                text: 'Ready'
            },
            error: {
                variant: 'error' as const,
                icon: <HeroIcons.XCircle className="h-2.5 w-2.5" />,
                text: 'Error'
            },
            draft: {
                variant: 'secondary' as const,
                icon: <HeroIcons.DocumentText className="h-2.5 w-2.5" />,
                text: 'Draft'
            },
            uploaded: {
                variant: 'info' as const,
                icon: <HeroIcons.CheckCircle className="h-2.5 w-2.5" />,
                text: 'Uploaded'
            },
            archived: {
                variant: 'secondary' as const,
                icon: <HeroIcons.DocumentText className="h-2.5 w-2.5" />,
                text: 'Archived'
            }
        }

        const { variant, icon, text } = config[status]

        return (
            <Badge
                ref={ref}
                variant={variant}
                icon={icon}
                {...props}
            >
                {text}
            </Badge>
        )
    }
)
VideoStatusBadge.displayName = 'VideoStatusBadge'

/**
 * User Status Badge
 */
export interface UserStatusBadgeProps extends Omit<BadgeProps, 'variant' | 'icon'> {
    status: 'active' | 'inactive' | 'suspended' | 'pending'
}

const UserStatusBadge = React.forwardRef<HTMLDivElement, UserStatusBadgeProps>(
    ({ status, ...props }, ref) => {
        const config = {
            active: {
                variant: 'success' as const,
                icon: <HeroIcons.CheckCircle className="h-3 w-3" />,
                text: 'Active'
            },
            inactive: {
                variant: 'secondary' as const,
                icon: <HeroIcons.MinusCircle className="h-3 w-3" />,
                text: 'Inactive'
            },
            suspended: {
                variant: 'error' as const,
                icon: <HeroIcons.XCircle className="h-3 w-3" />,
                text: 'Suspended'
            },
            pending: {
                variant: 'warning' as const,
                icon: <HeroIcons.ExclamationTriangle className="h-3 w-3" />,
                text: 'Pending'
            }
        }

        const { variant, icon, text } = config[status]

        return (
            <Badge
                ref={ref}
                variant={variant}
                icon={icon}
                {...props}
            >
                {text}
            </Badge>
        )
    }
)
UserStatusBadge.displayName = 'UserStatusBadge'

export {
    Badge,
    SubscriptionBadge,
    AdminRoleBadge,
    VideoStatusBadge,
    UserStatusBadge,
    badgeVariants,
    HeroIcons
} 