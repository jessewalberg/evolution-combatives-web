/**
 * Evolution Combatives Stats Card Component System
 * Professional KPI display cards for tactical training admin analytics
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Stats card component system for analytics dashboard
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { formatCurrency, formatDuration } from '../../lib/utils'
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
} from '@heroicons/react/24/outline'

/**
 * Metric type for formatting values
 */
export type MetricType = 'currency' | 'percentage' | 'count' | 'duration' | 'decimal'

/**
 * Trend direction for indicators
 */
export type TrendDirection = 'up' | 'down' | 'neutral'

/**
 * Time period context
 */
export type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

/**
 * Stats card variants using class-variance-authority
 * Matches Evolution Combatives tactical design system
 */
const statsCardVariants = cva(
    [
        // Base styles - consistent across all variants
        'relative overflow-hidden rounded-lg border bg-card text-card-foreground',
        'transition-all duration-200 ease-in-out',
        'hover:shadow-lg',
    ],
    {
        variants: {
            variant: {
                // Default - Standard KPI card
                metric: [
                    'border-border',
                    'hover:border-border/80',
                ],

                // Revenue - Financial metrics with green accent
                revenue: [
                    'border-border hover:border-green-200 dark:hover:border-green-500/30',
                ],

                // Engagement - User interaction metrics with blue accent
                engagement: [
                    'border-border hover:border-blue-200 dark:hover:border-blue-500/30',
                ],

                // Growth - Growth metrics with purple accent
                growth: [
                    'border-border hover:border-purple-200 dark:hover:border-purple-500/30',
                ],
            },

            size: {
                // Compact - Single row layout
                sm: 'p-4',

                // Default - Standard card size
                default: 'p-6',

                // Large - Emphasized metrics
                lg: 'p-8',
            },

            loading: {
                true: 'animate-pulse',
                false: '',
            }
        },
        defaultVariants: {
            variant: 'metric',
            size: 'default',
            loading: false,
        },
    }
)

/**
 * Trend indicator variants
 */
const trendVariants = cva(
    [
        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
        'transition-colors duration-200',
    ],
    {
        variants: {
            direction: {
                up: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
                down: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
                neutral: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-600/20 dark:text-gray-400 dark:border-gray-600/30',
            }
        },
        defaultVariants: {
            direction: 'neutral',
        },
    }
)

/**
 * Stats card props interface
 */
export interface StatsCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statsCardVariants> {
    /**
     * Primary metric value
     */
    value: number | string

    /**
     * Card title/label
     */
    title: string

    /**
     * Metric type for formatting
     */
    metricType?: MetricType

    /**
     * Previous value for comparison
     */
    previousValue?: number

    /**
     * Manual percentage change (overrides calculated change)
     */
    percentageChange?: number

    /**
     * Trend direction (overrides calculated trend)
     */
    trend?: TrendDirection

    /**
     * Time period context
     */
    timePeriod?: TimePeriod

    /**
     * Custom time period label
     */
    customPeriodLabel?: string

    /**
     * Icon component
     */
    icon?: React.ComponentType<{ className?: string }>

    /**
     * Additional subtitle or description
     */
    subtitle?: string

    /**
     * Whether to show trend indicator
     */
    showTrend?: boolean

    /**
     * Custom trend label
     */
    trendLabel?: string

    /**
     * Loading state
     */
    isLoading?: boolean

    /**
     * Click handler
     */
    onClick?: () => void
}

/**
 * Format metric value based on type
 */
const formatMetricValue = (value: number | string, type: MetricType): string => {
    if (typeof value === 'string') return value

    switch (type) {
        case 'currency':
            return formatCurrency(Math.round(value * 100)) // Convert to cents for formatCurrency
        case 'percentage':
            return `${value.toFixed(1)}%`
        case 'count':
            return value.toLocaleString()
        case 'duration':
            return formatDuration(value)
        case 'decimal':
            return value.toFixed(2)
        default:
            return value.toString()
    }
}

/**
 * Get time period label
 */
const getTimePeriodLabel = (period: TimePeriod, customLabel?: string): string => {
    if (period === 'custom' && customLabel) return customLabel

    const labels: Record<TimePeriod, string> = {
        hour: 'vs last hour',
        day: 'vs yesterday',
        week: 'vs last week',
        month: 'vs last month',
        quarter: 'vs last quarter',
        year: 'vs last year',
        custom: 'vs previous',
    }

    return labels[period]
}

/**
 * Calculate percentage change
 */
const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
}

/**
 * Determine trend direction from percentage change
 */
const getTrendDirection = (change: number): TrendDirection => {
    if (Math.abs(change) < 0.1) return 'neutral'
    return change > 0 ? 'up' : 'down'
}

/**
 * Trend Icon Component
 */
const TrendIcon: React.FC<{ direction: TrendDirection; className?: string }> = ({
    direction,
    className
}) => {
    const iconProps = { className: cn('h-4 w-4', className) }

    switch (direction) {
        case 'up':
            return <ArrowTrendingUpIcon {...iconProps} />
        case 'down':
            return <ArrowTrendingDownIcon {...iconProps} />
        case 'neutral':
        default:
            return <MinusIcon {...iconProps} />
    }
}

/**
 * Loading Skeleton Component
 */
const StatsCardSkeleton: React.FC<{ size?: 'sm' | 'default' | 'lg' | null }> = ({ size = 'default' }) => {
    const validSize = size || 'default'
    return (
        <div className={cn(statsCardVariants({ size: validSize, loading: true }))}>
            <div className="space-y-3">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>

                {/* Value skeleton */}
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>

                {/* Trend skeleton */}
                <div className="flex items-center justify-between">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
            </div>
        </div>
    )
}

/**
 * Professional Stats Card Component
 * 
 * @example
 * ```tsx
 * // Revenue card
 * <StatsCard
 *   title="Monthly Revenue"
 *   value={45280}
 *   metricType="currency"
 *   previousValue={38940}
 *   timePeriod="month"
 *   variant="revenue"
 *   icon={CurrencyDollarIcon}
 * />
 * 
 * // User engagement card
 * <StatsCard
 *   title="Active Users"
 *   value={1247}
 *   metricType="count"
 *   percentageChange={12.5}
 *   trend="up"
 *   variant="engagement"
 *   icon={UsersIcon}
 * />
 * ```
 */
const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
    ({
        value,
        title,
        metricType = 'count',
        previousValue,
        percentageChange,
        trend,
        timePeriod = 'month',
        customPeriodLabel,
        icon: Icon,
        subtitle,
        showTrend = true,
        trendLabel,
        isLoading = false,
        onClick,
        variant,
        size,
        className,
        ...props
    }, ref) => {
        // Show skeleton if loading
        if (isLoading) {
            return <StatsCardSkeleton size={size} />
        }

        // Calculate trend metrics
        const numericValue = typeof value === 'number' ? value : parseFloat(value.toString()) || 0
        const numericPrevious = previousValue || 0

        const calculatedChange = percentageChange !== undefined
            ? percentageChange
            : previousValue !== undefined
                ? calculatePercentageChange(numericValue, numericPrevious)
                : 0

        const finalTrend = trend || getTrendDirection(calculatedChange)
        const formattedValue = formatMetricValue(value, metricType)
        const periodLabel = getTimePeriodLabel(timePeriod, customPeriodLabel)

        const isClickable = Boolean(onClick)

        return (
            <div
                ref={ref}
                className={cn(
                    statsCardVariants({ variant, size }),
                    isClickable && 'cursor-pointer hover:scale-[1.02]',
                    className
                )}
                onClick={onClick}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onClick?.()
                    }
                } : undefined}
                {...props}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-muted-foreground truncate">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {Icon && (
                        <div className="flex-shrink-0 ml-3">
                            <div
                                className={cn(
                                    'p-2 rounded-lg',
                                    variant === 'revenue' && 'bg-green-100 text-green-600',
                                    variant === 'engagement' && 'bg-blue-100 text-blue-600',
                                    variant === 'growth' && 'bg-purple-100 text-purple-600',
                                    variant === 'metric' && 'bg-muted text-muted-foreground'
                                )}
                                style={{
                                    ...(variant === 'engagement' && {
                                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                        color: 'rgb(147, 197, 253)'
                                    }),
                                    ...(variant === 'growth' && {
                                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                        color: 'rgb(196, 181, 253)'
                                    }),
                                    ...(variant === 'revenue' && {
                                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                        color: 'rgb(134, 239, 172)'
                                    })
                                }}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Value */}
                <div className="mb-4">
                    <div className={cn(
                        'text-2xl font-bold text-foreground leading-tight',
                        size === 'sm' && 'text-xl',
                        size === 'lg' && 'text-3xl'
                    )}>
                        {formattedValue}
                    </div>
                </div>

                {/* Trend Indicator */}
                {showTrend && (calculatedChange !== 0 || trend) && (
                    <div className="flex items-center justify-between">
                        <div className={cn(trendVariants({ direction: finalTrend }))}>
                            <TrendIcon direction={finalTrend} />
                            <span>
                                {Math.abs(calculatedChange).toFixed(1)}%
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                            {periodLabel}
                        </span>
                    </div>
                )}

                {/* Custom trend label */}
                {showTrend && trendLabel && !calculatedChange && (
                    <div className="text-xs text-muted-foreground">
                        {trendLabel}
                    </div>
                )}

                {/* Accent border for variants */}
                <div className={cn(
                    'absolute bottom-0 left-0 right-0 h-1',
                    variant === 'revenue' && 'bg-gradient-to-r from-green-400 to-green-300 dark:from-green-500/50 dark:to-green-400/30',
                    variant === 'engagement' && 'bg-gradient-to-r from-blue-400 to-blue-300 dark:from-blue-500/50 dark:to-blue-400/30',
                    variant === 'growth' && 'bg-gradient-to-r from-purple-400 to-purple-300 dark:from-purple-500/50 dark:to-purple-400/30',
                    variant === 'metric' && 'bg-gradient-to-r from-gray-400 to-gray-300 dark:from-gray-600/50 dark:to-gray-500/30'
                )} />
            </div>
        )
    }
)

StatsCard.displayName = 'StatsCard'

/**
 * Stats Card Grid Component for layout management
 */
export interface StatsCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    columns?: 1 | 2 | 3 | 4
}

const StatsCardGrid = React.forwardRef<HTMLDivElement, StatsCardGridProps>(
    ({ children, columns = 3, className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'grid gap-6',
                    columns === 1 && 'grid-cols-1',
                    columns === 2 && 'grid-cols-1 md:grid-cols-2',
                    columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                    columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

StatsCardGrid.displayName = 'StatsCardGrid'

/**
 * Compact Stats Row for dashboard headers
 */
export interface CompactStatsRowProps extends React.HTMLAttributes<HTMLDivElement> {
    stats: Array<{
        label: string
        value: number | string
        metricType?: MetricType
        change?: number
        trend?: TrendDirection
    }>
}

const CompactStatsRow = React.forwardRef<HTMLDivElement, CompactStatsRowProps>(
    ({ stats, className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'flex items-center gap-8 p-4 bg-white rounded-lg border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700',
                    className
                )}
                {...props}
            >
                {stats.map((stat, index) => (
                    <div key={index} className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatMetricValue(stat.value, stat.metricType || 'count')}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {stat.label}
                            </div>
                        </div>
                        {(stat.change !== undefined || stat.trend) && (
                            <div className={cn(
                                trendVariants({
                                    direction: stat.trend || getTrendDirection(stat.change || 0)
                                }),
                                'flex-shrink-0'
                            )}>
                                <TrendIcon
                                    direction={stat.trend || getTrendDirection(stat.change || 0)}
                                />
                                <span>{Math.abs(stat.change || 0).toFixed(1)}%</span>
                            </div>
                        )}
                        {index < stats.length - 1 && (
                            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                        )}
                    </div>
                ))}
            </div>
        )
    }
)

CompactStatsRow.displayName = 'CompactStatsRow'

// Export all components and utilities
export {
    StatsCard,
    StatsCardGrid,
    CompactStatsRow,
    StatsCardSkeleton,
    TrendIcon,
    statsCardVariants,
    trendVariants,
    formatMetricValue,
    calculatePercentageChange,
    getTrendDirection,
    getTimePeriodLabel,
}

export default StatsCard 