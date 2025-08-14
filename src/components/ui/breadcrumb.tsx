/**
 * Evolution Combatives Breadcrumb Navigation Component
 * Professional breadcrumb navigation for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Hierarchical navigation component with responsive design
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import {
    ChevronRightIcon,
    HomeIcon,
    EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'

/**
 * Breadcrumb item interface
 */
export interface BreadcrumbItem {
    /** Display text for the breadcrumb item */
    label: string
    /** URL path for navigation (optional for current page) */
    href?: string
    /** Icon to display before the label */
    icon?: React.ComponentType<{ className?: string }>
    /** Whether this item is the current page */
    isCurrent?: boolean
}

/**
 * Breadcrumb variants using class-variance-authority
 */
const breadcrumbVariants = cva(
    [
        'flex items-center space-x-1 text-sm',
        'overflow-hidden' // Prevent container overflow
    ],
    {
        variants: {
            size: {
                sm: 'text-xs',
                md: 'text-sm',
                lg: 'text-base',
            },
            appearance: {
                default: '',
                subtle: 'opacity-80',
                minimal: 'opacity-60',
            }
        },
        defaultVariants: {
            size: 'md',
            appearance: 'default',
        },
    }
)

/**
 * Breadcrumb item variants
 */
const breadcrumbItemVariants = cva(
    [
        'inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md',
        'transition-all duration-200 ease-in-out',
        'font-medium truncate max-w-32 sm:max-w-48 md:max-w-64',
    ],
    {
        variants: {
            variant: {
                // Clickable breadcrumb items
                link: [
                    'text-neutral-400 hover:text-neutral-0',
                    'hover:bg-neutral-800/50',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
                    'cursor-pointer'
                ],
                // Current page (non-clickable)
                current: [
                    'text-neutral-0 font-semibold',
                    'bg-neutral-800/30',
                    'cursor-default'
                ],
                // Collapsed items indicator
                collapsed: [
                    'text-neutral-500 hover:text-neutral-300',
                    'hover:bg-neutral-800/30',
                    'cursor-pointer'
                ]
            }
        },
        defaultVariants: {
            variant: 'link',
        },
    }
)

/**
 * Separator component
 */
const BreadcrumbSeparator: React.FC<{ className?: string }> = ({ className }) => (
    <ChevronRightIcon
        className={cn(
            'h-4 w-4 text-neutral-500 flex-shrink-0',
            className
        )}
    />
)

/**
 * Breadcrumb component props
 */
export interface BreadcrumbProps
    extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof breadcrumbVariants> {
    /** Array of breadcrumb items */
    items: BreadcrumbItem[]
    /** Maximum number of items to show before collapsing */
    maxItems?: number
    /** Custom separator component */
    separator?: React.ReactNode
    /** Home icon for the first item */
    showHomeIcon?: boolean
    /** Callback when breadcrumb item is clicked */
    onItemClick?: (item: BreadcrumbItem, index: number) => void
}

/**
 * Professional Breadcrumb Navigation Component
 * 
 * @example
 * ```tsx
 * const breadcrumbItems = [
 *   { label: 'Dashboard', href: '/admin' },
 *   { label: 'Content', href: '/admin/content' },
 *   { label: 'Videos', href: '/dashboard/content/videos' },
 *   { label: 'Upload New Video', isCurrent: true }
 * ]
 * 
 * <Breadcrumb 
 *   items={breadcrumbItems}
 *   maxItems={4}
 *   showHomeIcon={true}
 * />
 * ```
 */
const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
    ({
        items,
        maxItems = 4,
        separator,
        showHomeIcon = true,
        onItemClick,
        size,
        appearance,
        className,
        ...props
    }, ref) => {
        const [isCollapsed, setIsCollapsed] = React.useState(false)
        const [collapsedItems, setCollapsedItems] = React.useState<BreadcrumbItem[]>([])
        const [visibleItems, setVisibleItems] = React.useState<BreadcrumbItem[]>([])

        // Process items for collapse functionality
        React.useEffect(() => {
            if (items.length <= maxItems) {
                setIsCollapsed(false)
                setVisibleItems(items)
                setCollapsedItems([])
                return
            }

            setIsCollapsed(true)
            // Show first item, collapsed indicator, and last (maxItems - 2) items
            const firstItem = items[0]
            const lastItems = items.slice(-(maxItems - 2))
            const hiddenItems = items.slice(1, -(maxItems - 2))

            setVisibleItems([firstItem, ...lastItems])
            setCollapsedItems(hiddenItems)
        }, [items, maxItems])

        const handleItemClick = (item: BreadcrumbItem, index: number) => {
            onItemClick?.(item, index)
        }

        const handleCollapsedClick = () => {
            // Show all items when collapsed section is clicked
            setIsCollapsed(false)
            setVisibleItems(items)
        }

        const renderBreadcrumbItem = (item: BreadcrumbItem, index: number, isLast: boolean) => {
            const variant = item.isCurrent || isLast ? 'current' : 'link'

            return (
                <React.Fragment key={`${item.label}-${index}`}>
                    {item.href ? (
                        <Link
                            href={item.href}
                            className={cn(breadcrumbItemVariants({ variant }))}
                            onClick={() => handleItemClick(item, index)}
                            aria-current={item.isCurrent || isLast ? 'page' : undefined}
                            title={item.label}
                        >
                            {/* Home icon for first item */}
                            {index === 0 && showHomeIcon && (
                                <HomeIcon className="h-4 w-4 flex-shrink-0" />
                            )}

                            {/* Custom icon */}
                            {item.icon && index !== 0 && (
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                            )}

                            {/* Label with truncation */}
                            <span className="truncate">
                                {item.label}
                            </span>
                        </Link>
                    ) : (
                        <span
                            className={cn(breadcrumbItemVariants({ variant }))}
                            onClick={() => handleItemClick(item, index)}
                            aria-current={item.isCurrent || isLast ? 'page' : undefined}
                            title={item.label}
                        >
                            {/* Home icon for first item */}
                            {index === 0 && showHomeIcon && (
                                <HomeIcon className="h-4 w-4 flex-shrink-0" />
                            )}

                            {/* Custom icon */}
                            {item.icon && index !== 0 && (
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                            )}

                            {/* Label with truncation */}
                            <span className="truncate">
                                {item.label}
                            </span>
                        </span>
                    )}

                    {/* Separator */}
                    {!isLast && (
                        <span className="flex-shrink-0">
                            {separator || <BreadcrumbSeparator />}
                        </span>
                    )}
                </React.Fragment>
            )
        }

        const renderCollapsedIndicator = () => (
            <React.Fragment key="collapsed">
                <button
                    onClick={handleCollapsedClick}
                    className={cn(breadcrumbItemVariants({ variant: 'collapsed' }))}
                    title={`Show ${collapsedItems.length} hidden items: ${collapsedItems.map(item => item.label).join(', ')}`}
                    aria-label={`Expand ${collapsedItems.length} hidden breadcrumb items`}
                >
                    <EllipsisHorizontalIcon className="h-4 w-4" />
                    <span className="sr-only">
                        {collapsedItems.length} more items
                    </span>
                </button>
                <span className="flex-shrink-0">
                    {separator || <BreadcrumbSeparator />}
                </span>
            </React.Fragment>
        )

        if (items.length === 0) {
            return null
        }

        return (
            <nav
                ref={ref}
                className={cn(breadcrumbVariants({ size, appearance }), className)}
                aria-label="Breadcrumb navigation"
                {...props}
            >
                <ol className="flex items-center space-x-1 min-w-0 flex-1">
                    {isCollapsed ? (
                        <>
                            {/* First item */}
                            {renderBreadcrumbItem(visibleItems[0], 0, false)}

                            {/* Separator */}
                            <span className="flex-shrink-0">
                                {separator || <BreadcrumbSeparator />}
                            </span>

                            {/* Collapsed indicator */}
                            {renderCollapsedIndicator()}

                            {/* Last items */}
                            {visibleItems.slice(1).map((item, index) =>
                                renderBreadcrumbItem(
                                    item,
                                    index + 1,
                                    index === visibleItems.length - 2
                                )
                            )}
                        </>
                    ) : (
                        visibleItems.map((item, index) =>
                            renderBreadcrumbItem(
                                item,
                                index,
                                index === visibleItems.length - 1
                            )
                        )
                    )}
                </ol>
            </nav>
        )
    }
)

Breadcrumb.displayName = 'Breadcrumb'

/**
 * Hook for managing breadcrumb state
 */
export const useBreadcrumb = (initialItems: BreadcrumbItem[] = []) => {
    const [items, setItems] = React.useState<BreadcrumbItem[]>(initialItems)

    const addItem = React.useCallback((item: BreadcrumbItem) => {
        setItems(prev => [...prev, item])
    }, [])

    const removeItem = React.useCallback((index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
    }, [])

    const updateItem = React.useCallback((index: number, updates: Partial<BreadcrumbItem>) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, ...updates } : item
        ))
    }, [])

    const reset = React.useCallback((newItems: BreadcrumbItem[] = []) => {
        setItems(newItems)
    }, [])

    const setCurrentPage = React.useCallback((label: string) => {
        setItems(prev => prev.map((item, index) => ({
            ...item,
            isCurrent: index === prev.length - 1,
            href: index === prev.length - 1 ? undefined : item.href
        })))

        // Add current page if it's not the last item
        setItems(prev => {
            const lastItem = prev[prev.length - 1]
            if (lastItem?.label !== label) {
                return [...prev, { label, isCurrent: true }]
            }
            return prev
        })
    }, [])

    return {
        items,
        addItem,
        removeItem,
        updateItem,
        reset,
        setCurrentPage,
    }
}

/**
 * Breadcrumb context for nested components
 */
export interface BreadcrumbContextValue {
    items: BreadcrumbItem[]
    addItem: (item: BreadcrumbItem) => void
    removeItem: (index: number) => void
    updateItem: (index: number, updates: Partial<BreadcrumbItem>) => void
    reset: (items?: BreadcrumbItem[]) => void
    setCurrentPage: (label: string) => void
}

export const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null)

/**
 * Breadcrumb provider component
 */
export interface BreadcrumbProviderProps {
    children: React.ReactNode
    initialItems?: BreadcrumbItem[]
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({
    children,
    initialItems = []
}) => {
    const breadcrumbState = useBreadcrumb(initialItems)

    return (
        <BreadcrumbContext.Provider value={breadcrumbState}>
            {children}
        </BreadcrumbContext.Provider>
    )
}

/**
 * Hook to use breadcrumb context
 */
export const useBreadcrumbContext = () => {
    const context = React.useContext(BreadcrumbContext)
    if (!context) {
        throw new Error('useBreadcrumbContext must be used within a BreadcrumbProvider')
    }
    return context
}

// Export component and utilities
export { Breadcrumb, BreadcrumbSeparator }
export default Breadcrumb 