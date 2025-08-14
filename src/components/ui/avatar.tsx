/**
 * Evolution Combatives Avatar Component System
 * Professional avatar components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Avatar component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import Image from 'next/image'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, generateInitials } from '../../lib/utils'

/**
 * Avatar variants using class-variance-authority
 * Matches Evolution Combatives tactical design system
 */
const avatarVariants = cva(
    [
        // Base styles - consistent across all variants
        'relative inline-flex items-center justify-center',
        'rounded-full bg-neutral-700 text-neutral-0',
        'font-medium select-none overflow-hidden',
        'border-2 border-neutral-600',
        'transition-all duration-200'
    ],
    {
        variants: {
            size: {
                // Extra small - 24px
                xs: 'h-6 w-6 text-xs',

                // Small - 32px
                sm: 'h-8 w-8 text-sm',

                // Default - 40px (matches mobile app)
                default: 'h-10 w-10 text-sm',

                // Large - 48px
                lg: 'h-12 w-12 text-base',

                // Extra large - 64px
                xl: 'h-16 w-16 text-lg'
            },

            variant: {
                // Default - Neutral background
                default: 'bg-neutral-700 border-neutral-600',

                // Primary - Brand colored background
                primary: 'bg-primary-600 border-primary-500',

                // Success - Green background
                success: 'bg-success-600 border-success-500',

                // Warning - Orange background
                warning: 'bg-warning-600 border-warning-500',

                // Error - Red background
                error: 'bg-error-600 border-error-500',

                // Info - Blue background
                info: 'bg-info-600 border-info-500'
            },

            interactive: {
                true: 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95',
                false: ''
            }
        },
        defaultVariants: {
            size: 'default',
            variant: 'default',
            interactive: false
        }
    }
)

/**
 * Status indicator variants
 */
const statusIndicatorVariants = cva(
    [
        'absolute rounded-full border-2 border-neutral-800',
        'transition-all duration-200'
    ],
    {
        variants: {
            size: {
                xs: 'h-2 w-2 bottom-0 right-0',
                sm: 'h-2.5 w-2.5 bottom-0 right-0',
                default: 'h-3 w-3 bottom-0 right-0',
                lg: 'h-3.5 w-3.5 bottom-0.5 right-0.5',
                xl: 'h-4 w-4 bottom-1 right-1'
            },
            status: {
                online: 'bg-success-500',
                offline: 'bg-neutral-500',
                away: 'bg-warning-500',
                busy: 'bg-error-500'
            }
        }
    }
)

/**
 * Role badge variants for avatar overlays
 */
const roleBadgeVariants = cva(
    [
        'absolute rounded-full border-2 border-neutral-800',
        'flex items-center justify-center',
        'transition-all duration-200'
    ],
    {
        variants: {
            size: {
                xs: 'h-3 w-3 -top-0.5 -right-0.5',
                sm: 'h-3.5 w-3.5 -top-0.5 -right-0.5',
                default: 'h-4 w-4 -top-1 -right-1',
                lg: 'h-5 w-5 -top-1 -right-1',
                xl: 'h-6 w-6 -top-1.5 -right-1.5'
            }
        }
    }
)

/**
 * Generate avatar background color based on name
 */
const getAvatarBackgroundColor = (name: string): string => {
    const colors = [
        'bg-primary-600 border-primary-500',
        'bg-success-600 border-success-500',
        'bg-warning-600 border-warning-500',
        'bg-error-600 border-error-500',
        'bg-info-600 border-info-500',
        'bg-purple-600 border-purple-500',
        'bg-pink-600 border-pink-500',
        'bg-indigo-600 border-indigo-500',
        'bg-teal-600 border-teal-500',
        'bg-orange-600 border-orange-500'
    ]

    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
}

/**
 * Avatar component props interface
 */
export interface AvatarProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
    /**
     * User's name for initials fallback
     */
    name?: string

    /**
     * Image URL for avatar
     */
    src?: string

    /**
     * Alt text for image
     */
    alt?: string

    /**
     * Online status indicator
     */
    status?: 'online' | 'offline' | 'away' | 'busy'

    /**
     * Admin role for badge overlay
     */
    role?: 'super_admin' | 'content_admin' | 'support_admin'

    /**
     * Whether the avatar is clickable
     */
    interactive?: boolean

    /**
     * Click handler for interactive avatars
     */
    onAvatarClick?: () => void

    /**
     * Loading state
     */
    loading?: boolean
}

/**
 * Professional Avatar Component
 * 
 * @example
 * ```tsx
 * // Basic avatar with initials
 * <Avatar name="John Smith" />
 * 
 * // Avatar with image and status
 * <Avatar 
 *   name="John Smith" 
 *   src="/avatars/john.jpg" 
 *   status="online"
 *   size="lg"
 * />
 * 
 * // Interactive avatar with role badge
 * <Avatar 
 *   name="Admin User"
 *   role="super_admin"
 *   interactive
 *   onAvatarClick={() => console.log('Avatar clicked')}
 * />
 * ```
 */
const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
    ({
        className,
        size,
        variant,
        interactive,
        name = '',
        src,
        alt,
        status,
        role,
        onAvatarClick,
        onClick,
        loading,
        ...props
    }, ref) => {
        const [imageError, setImageError] = React.useState(false)
        const [imageLoaded, setImageLoaded] = React.useState(false)

        const initials = generateInitials(name, 2)
        const shouldShowImage = src && !imageError && imageLoaded
        const shouldShowInitials = !shouldShowImage && initials
        const shouldShowStatus = status && !loading
        const shouldShowRole = role && !loading

        // Generate background color for initials
        const initialsBackground = React.useMemo(() => {
            return variant === 'default' && name ? getAvatarBackgroundColor(name) : ''
        }, [variant, name])

        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
            onClick?.(event)
            onAvatarClick?.()
        }

        const handleImageLoad = () => {
            setImageLoaded(true)
            setImageError(false)
        }

        const handleImageError = () => {
            setImageError(true)
            setImageLoaded(false)
        }

        // Role badge icon based on role
        const getRoleIcon = (role: string, size: string) => {
            const iconSize = size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'

            switch (role) {
                case 'super_admin':
                    return (
                        <svg className={cn(iconSize, 'text-white')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    )
                case 'content_admin':
                    return (
                        <svg className={cn(iconSize, 'text-white')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )
                case 'support_admin':
                    return (
                        <svg className={cn(iconSize, 'text-white')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-3.448a1.5 1.5 0 010 2.12m0-2.12a1.5 1.5 0 00-2.12 0m2.12 0l-2.879 2.879m2.879-2.879l2.879-2.879m0 0a9.027 9.027 0 001.306-1.652M4.33 16.712a9.027 9.027 0 01-1.306-1.652M4.33 16.712l4.138-3.448m-4.138 3.448a9.014 9.014 0 000-9.424m4.138 3.448a1.5 1.5 0 000-2.12m0 2.12a1.5 1.5 0 002.12 0m-2.12 0l2.879-2.879m-2.879 2.879l-2.879 2.879m0 0a9.027 9.027 0 01-1.306 1.652" />
                        </svg>
                    )
                default:
                    return null
            }
        }

        const getRoleBadgeColor = (role: string) => {
            switch (role) {
                case 'super_admin':
                    return 'bg-error-600'
                case 'content_admin':
                    return 'bg-primary-600'
                case 'support_admin':
                    return 'bg-success-600'
                default:
                    return 'bg-neutral-600'
            }
        }

        return (
            <div
                ref={ref}
                className={cn(
                    avatarVariants({ size, variant: variant === 'default' && name ? undefined : variant, interactive }),
                    variant === 'default' && name && initialsBackground,
                    loading && 'animate-pulse bg-neutral-700',
                    className
                )}
                onClick={interactive || onAvatarClick ? handleClick : onClick}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={alt || `Avatar for ${name}`}
                {...props}
            >
                {/* Image */}
                {src && (
                    <Image
                        src={src}
                        alt={alt || name || 'Avatar'}
                        fill
                        className={cn(
                            'object-cover',
                            shouldShowImage ? 'opacity-100' : 'opacity-0'
                        )}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        sizes="(max-width: 768px) 64px, 64px"
                    />
                )}

                {/* Initials fallback */}
                {shouldShowInitials && (
                    <span className="font-medium leading-none">
                        {initials}
                    </span>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center">
                        <svg
                            className="h-4 w-4 animate-spin text-neutral-400"
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
                    </div>
                )}

                {/* Status indicator */}
                {shouldShowStatus && (
                    <div
                        className={cn(statusIndicatorVariants({ size, status }))}
                        aria-label={`Status: ${status}`}
                    />
                )}

                {/* Role badge */}
                {shouldShowRole && (
                    <div
                        className={cn(
                            roleBadgeVariants({ size }),
                            getRoleBadgeColor(role)
                        )}
                        aria-label={`Role: ${role.replace('_', ' ')}`}
                    >
                        {getRoleIcon(role, size || 'default')}
                    </div>
                )}
            </div>
        )
    }
)
Avatar.displayName = 'Avatar'

/**
 * Avatar Group component for displaying multiple avatars
 */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Maximum number of avatars to show before showing count
     */
    max?: number

    /**
     * Size of avatars in the group
     */
    size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'

    /**
     * Avatar data
     */
    avatars: Array<{
        name: string
        src?: string
        alt?: string
        status?: 'online' | 'offline' | 'away' | 'busy'
        role?: 'super_admin' | 'content_admin' | 'support_admin'
    }>

    /**
     * Whether avatars are interactive
     */
    interactive?: boolean

    /**
     * Click handler for individual avatars
     */
    onAvatarClick?: (index: number, avatar: AvatarGroupProps['avatars'][0]) => void

    /**
     * Click handler for overflow count
     */
    onOverflowClick?: () => void
}

/**
 * Avatar Group Component
 * 
 * @example
 * ```tsx
 * <AvatarGroup
 *   max={3}
 *   size="sm"
 *   avatars={[
 *     { name: 'John Smith', src: '/avatars/john.jpg', status: 'online' },
 *     { name: 'Jane Doe', status: 'away' },
 *     { name: 'Bob Wilson', role: 'super_admin' }
 *   ]}
 *   onAvatarClick={(index, avatar) => console.log('Clicked:', avatar.name)}
 * />
 * ```
 */
const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
    ({
        className,
        max = 4,
        size = 'default',
        avatars = [],
        interactive,
        onAvatarClick,
        onOverflowClick,
        ...props
    }, ref) => {
        const visibleAvatars = avatars.slice(0, max)
        const overflowCount = Math.max(0, avatars.length - max)

        const getAvatarSpacing = (size: string) => {
            switch (size) {
                case 'xs':
                    return '-space-x-1'
                case 'sm':
                    return '-space-x-1.5'
                case 'default':
                    return '-space-x-2'
                case 'lg':
                    return '-space-x-2.5'
                case 'xl':
                    return '-space-x-3'
                default:
                    return '-space-x-2'
            }
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'flex items-center',
                    getAvatarSpacing(size),
                    className
                )}
                {...props}
            >
                {visibleAvatars.map((avatar, index) => (
                    <Avatar
                        key={`${avatar.name}-${index}`}
                        size={size}
                        name={avatar.name}
                        src={avatar.src}
                        alt={avatar.alt}
                        status={avatar.status}
                        role={avatar.role}
                        interactive={interactive}
                        onAvatarClick={onAvatarClick ? () => onAvatarClick(index, avatar) : undefined}
                        className="ring-2 ring-neutral-800 hover:z-10"
                    />
                ))}

                {/* Overflow count */}
                {overflowCount > 0 && (
                    <div
                        className={cn(
                            avatarVariants({ size, interactive: !!onOverflowClick }),
                            'bg-neutral-600 text-neutral-200 ring-2 ring-neutral-800',
                            'hover:z-10'
                        )}
                        onClick={onOverflowClick}
                        role={onOverflowClick ? 'button' : undefined}
                        tabIndex={onOverflowClick ? 0 : undefined}
                        aria-label={`${overflowCount} more users`}
                    >
                        <span className="font-medium">
                            +{overflowCount}
                        </span>
                    </div>
                )}
            </div>
        )
    }
)
AvatarGroup.displayName = 'AvatarGroup'

export {
    Avatar,
    AvatarGroup,
    avatarVariants,
    statusIndicatorVariants,
    roleBadgeVariants
} 