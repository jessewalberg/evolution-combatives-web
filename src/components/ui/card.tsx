/**
 * Evolution Combatives Card Component System
 * Professional card components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Card component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { componentClasses } from '../../theme';

const cardVariants = cva(componentClasses.card.base, {
    variants: {
        variant: {
            default: componentClasses.card.default,
            elevated: componentClasses.card.elevated,
            interactive: componentClasses.card.interactive,
            bordered: 'border-neutral-600 shadow-sm hover:border-neutral-500 hover:shadow-md',
            glass: 'border-neutral-700/50 shadow-sm bg-neutral-800/80 backdrop-blur-sm hover:bg-neutral-800/90 hover:shadow-md',
        },

            padding: {
                // None - No padding (for custom layouts)
                none: 'p-0',

                // Small - 16px padding
                sm: 'p-4',

                // Default - 24px padding
                default: 'p-6',

                // Large - 32px padding
                lg: 'p-8',
            }
        },
        defaultVariants: {
            variant: 'default',
            padding: 'default'
        }
    }
)

/**
 * Card component props interface
 */
export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
    /**
     * Whether the card is clickable/interactive
     */
    interactive?: boolean

    /**
     * Optional click handler for interactive cards
     */
    onCardClick?: () => void
}

/**
 * Professional Card Component
 * 
 * @example
 * ```tsx
 * // Basic card
 * <Card>
 *   <CardContent>Content here</CardContent>
 * </Card>
 * 
 * // Elevated card with header
 * <Card variant="elevated">
 *   <CardHeader>
 *     <CardTitle>Analytics</CardTitle>
 *     <CardDescription>Last 30 days</CardDescription>
 *   </CardHeader>
 *   <CardContent>Chart content</CardContent>
 * </Card>
 * ```
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({
        className,
        variant,
        padding,
        interactive,
        onCardClick,
        children,
        onClick,
        ...props
    }, ref) => {
        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
            onClick?.(event)
            onCardClick?.()
        }

        return (
            <div
                ref={ref}
                className={cn(
                    cardVariants({
                        variant: interactive ? 'interactive' : variant,
                        padding
                    }),
                    className
                )}
                onClick={interactive || onCardClick ? handleClick : onClick}
                {...props}
            >
                {children}
            </div>
        )
    }
)

Card.displayName = 'Card'

/**
 * Card Header component for titles and descriptions
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('flex flex-col space-y-1.5', className)}
                {...props}
            >
                {children}
            </div>
        )
    }
)

CardHeader.displayName = 'CardHeader'

/**
 * Card Title component
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode
    /**
     * Heading level (default: h3)
     */
    level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, children, level = 'h3', ...props }, ref) => {
        const Heading = level

        const titleStyles = {
            h1: 'text-2xl font-bold tracking-tight',
            h2: 'text-xl font-semibold tracking-tight',
            h3: 'text-lg font-semibold leading-none tracking-tight',
            h4: 'text-base font-semibold leading-none tracking-tight',
            h5: 'text-sm font-medium leading-none tracking-tight',
            h6: 'text-xs font-medium leading-none tracking-tight',
        }

        return (
            <Heading
                ref={ref}
                className={cn(
                    titleStyles[level],
                    'text-neutral-0',
                    className
                )}
                {...props}
            >
                {children}
            </Heading>
        )
    }
)

CardTitle.displayName = 'CardTitle'

/**
 * Card Description component
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
}

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <p
                ref={ref}
                className={cn(
                    'text-sm text-neutral-400 leading-relaxed',
                    className
                )}
                {...props}
            >
                {children}
            </p>
        )
    }
)

CardDescription.displayName = 'CardDescription'

/**
 * Card Content component
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('pt-0', className)}
                {...props}
            >
                {children}
            </div>
        )
    }
)

CardContent.displayName = 'CardContent'

/**
 * Card Footer component
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'flex items-center pt-6 space-x-2',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

CardFooter.displayName = 'CardFooter'

/**
 * Specialized Card Components
 */

/**
 * Stats Card for displaying key metrics
 */
export interface StatsCardProps extends Omit<CardProps, 'children'> {
    title: string
    value: string | number
    description?: string
    icon?: React.ReactNode
    trend?: {
        value: number
        isPositive: boolean
    }
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
    ({
        title,
        value,
        description,
        icon,
        trend,
        className,
        ...props
    }, ref) => {
        return (
            <Card
                ref={ref}
                className={cn('relative overflow-hidden', className)}
                {...props}
            >
                {/* Background accent */}
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-600" />

                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardDescription className="text-xs uppercase tracking-wide font-medium">
                            {title}
                        </CardDescription>
                        {icon && (
                            <div className="text-primary-500 opacity-60">
                                {icon}
                            </div>
                        )}
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="flex items-baseline space-x-2">
                        <div className="text-2xl font-bold text-neutral-0">
                            {value}
                        </div>
                        {trend && (
                            <div className={cn(
                                'flex items-center text-sm font-medium',
                                trend.isPositive ? 'text-success-500' : 'text-error-500'
                            )}>
                                <svg
                                    className={cn(
                                        'h-4 w-4 mr-1',
                                        trend.isPositive ? 'rotate-0' : 'rotate-180'
                                    )}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                                </svg>
                                {Math.abs(trend.value)}%
                            </div>
                        )}
                    </div>
                    {description && (
                        <p className="text-sm text-neutral-400 mt-2">
                            {description}
                        </p>
                    )}
                </CardContent>
            </Card>
        )
    }
)

StatsCard.displayName = 'StatsCard'

/**
 * Action Card for interactive dashboard items
 */
export interface ActionCardProps extends Omit<CardProps, 'children'> {
    title: string
    description: string
    icon?: React.ReactNode
    action?: {
        label: string
        onClick: () => void
    }
}

const ActionCard = React.forwardRef<HTMLDivElement, ActionCardProps>(
    ({ title, description, icon, action, className, ...props }, ref) => {
        return (
            <Card
                ref={ref}
                variant="interactive"
                className={cn('group', className)}
                onCardClick={action?.onClick}
                {...props}
            >
                <CardHeader>
                    <div className="flex items-start space-x-3">
                        {icon && (
                            <div className="flex-shrink-0 w-10 h-10 bg-primary-600/10 rounded-lg flex items-center justify-center text-primary-500 group-hover:bg-primary-600/20 transition-colors">
                                {icon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <CardTitle level="h4" className="group-hover:text-primary-300 transition-colors">
                                {title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {description}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                {action && (
                    <CardFooter className="pt-4">
                        <div className="text-sm font-medium text-primary-400 group-hover:text-primary-300 transition-colors">
                            {action.label} →
                        </div>
                    </CardFooter>
                )}
            </Card>
        )
    }
)

ActionCard.displayName = 'ActionCard'

export {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    StatsCard,
    ActionCard,
    cardVariants
} 