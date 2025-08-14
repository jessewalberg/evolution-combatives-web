/**
 * Evolution Combatives Table Component System
 * Professional data table components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Table component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Table sorting configuration
 */
export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig {
    key: string
    direction: SortDirection
}

export interface TableColumn<T = Record<string, unknown>> {
    key: string
    header: string
    accessor?: keyof T | ((row: T) => React.ReactNode)
    sortable?: boolean
    width?: string
    align?: 'left' | 'center' | 'right'
    className?: string
}

export interface TableData<T = Record<string, unknown>> {
    id: string | number
    data: T
    selected?: boolean
}

/**
 * Table variants using class-variance-authority
 */
const tableVariants = cva(
    [
        'w-full border-collapse',
        'text-sm text-gray-900 dark:text-white',
    ],
    {
        variants: {
            variant: {
                default: 'bg-white dark:bg-gray-800',
                bordered: 'border border-gray-200 dark:border-gray-700',
                striped: 'bg-white dark:bg-gray-800',
            },
            size: {
                sm: 'text-xs',
                default: 'text-sm',
                lg: 'text-base',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)

/**
 * Table root component
 */
export interface TableProps
    extends React.TableHTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableVariants> {
    children: React.ReactNode
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
    ({ className, variant, size, children, ...props }, ref) => {
        return (
            <div className="relative w-full overflow-auto">
                <table
                    ref={ref}
                    className={cn(tableVariants({ variant, size }), className)}
                    {...props}
                >
                    {children}
                </table>
            </div>
        )
    }
)
Table.displayName = 'Table'

/**
 * Table Header component
 */
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
    children: React.ReactNode
}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <thead
                ref={ref}
                className={cn(
                    'border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
                    className
                )}
                {...props}
            >
                {children}
            </thead>
        )
    }
)
TableHeader.displayName = 'TableHeader'

/**
 * Table Body component
 */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
    children: React.ReactNode
}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <tbody
                ref={ref}
                className={cn('[&_tr:last-child]:border-0', className)}
                {...props}
            >
                {children}
            </tbody>
        )
    }
)
TableBody.displayName = 'TableBody'

/**
 * Table Row component
 */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    children: React.ReactNode
    selected?: boolean
    hoverable?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
    ({ className, children, selected, hoverable = true, ...props }, ref) => {
        return (
            <tr
                ref={ref}
                className={cn(
                    'border-b border-gray-200 dark:border-gray-700 transition-colors',
                    hoverable && 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    selected && 'bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-600/30',
                    className
                )}
                {...props}
            >
                {children}
            </tr>
        )
    }
)
TableRow.displayName = 'TableRow'

/**
 * Table Head (header cell) component
 */
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
    children: React.ReactNode
    sortable?: boolean
    sortDirection?: SortDirection
    onSort?: () => void
    align?: 'left' | 'center' | 'right'
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
    ({
        className,
        children,
        sortable,
        sortDirection,
        onSort,
        align = 'left',
        ...props
    }, ref) => {
        const alignmentClasses = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right'
        }

        return (
            <th
                ref={ref}
                className={cn(
                    'h-12 px-4 font-medium text-gray-700 dark:text-gray-300',
                    alignmentClasses[align],
                    sortable && 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-white',
                    className
                )}
                onClick={sortable ? onSort : undefined}
                {...props}
            >
                <div className="flex items-center gap-2">
                    {children}
                    {sortable && (
                        <div className="flex flex-col">
                            <svg
                                className={cn(
                                    'h-3 w-3 transition-colors',
                                    sortDirection === 'asc' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'
                                )}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                            </svg>
                            <svg
                                className={cn(
                                    'h-3 w-3 -mt-1 transition-colors',
                                    sortDirection === 'desc' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'
                                )}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                        </div>
                    )}
                </div>
            </th>
        )
    }
)
TableHead.displayName = 'TableHead'

/**
 * Table Cell component
 */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    children: React.ReactNode
    align?: 'left' | 'center' | 'right'
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
    ({ className, children, align = 'left', ...props }, ref) => {
        const alignmentClasses = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right'
        }

        return (
            <td
                ref={ref}
                className={cn(
                    'px-4 py-3 text-gray-900 dark:text-white',
                    alignmentClasses[align],
                    className
                )}
                {...props}
            >
                {children}
            </td>
        )
    }
)
TableCell.displayName = 'TableCell'

/**
 * Table Caption component
 */
export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
    children: React.ReactNode
}

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <caption
                ref={ref}
                className={cn(
                    'mt-4 text-sm text-gray-600 dark:text-gray-400',
                    className
                )}
                {...props}
            >
                {children}
            </caption>
        )
    }
)
TableCaption.displayName = 'TableCaption'

/**
 * Loading Skeleton for table rows
 */
export interface TableSkeletonProps {
    rows?: number
    columns?: number
    className?: string
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
    rows = 5,
    columns = 4,
    className
}) => {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <TableRow key={rowIndex} hoverable={false}>
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <TableCell key={colIndex}>
                            <div
                                className={cn(
                                    'h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse',
                                    className
                                )}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}
TableSkeleton.displayName = 'TableSkeleton'

/**
 * Empty State component for tables
 */
export interface TableEmptyStateProps {
    title?: string
    description?: string
    icon?: React.ReactNode
    action?: {
        label: string
        onClick: () => void
    }
}

const TableEmptyState: React.FC<TableEmptyStateProps> = ({
    title = 'No data available',
    description = 'There are no records to display at the moment.',
    icon,
    action
}) => {
    return (
        <TableRow hoverable={false}>
            <TableCell colSpan={100} className="py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                    {icon && (
                        <div className="text-gray-400">
                            {icon}
                        </div>
                    )}
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                            {description}
                        </p>
                    </div>
                    {action && (
                        <button
                            onClick={action.onClick}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            {action.label}
                        </button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
}
TableEmptyState.displayName = 'TableEmptyState'

/**
 * Pagination component for tables
 */
export interface TablePaginationProps {
    currentPage: number
    totalPages: number
    pageSize: number
    totalItems: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (pageSize: number) => void
    pageSizeOptions?: number[]
    showPageSizeSelector?: boolean
    className?: string
}

const TablePagination: React.FC<TablePaginationProps> = ({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    showPageSizeSelector = true,
    className
}) => {
    const startItem = (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalItems)

    const goToPrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1)
        }
    }

    const goToNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1)
        }
    }

    const getPageNumbers = () => {
        const pages = []
        const maxVisiblePages = 5

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
            }
        } else {
            const half = Math.floor(maxVisiblePages / 2)
            let start = Math.max(1, currentPage - half)
            const end = Math.min(totalPages, start + maxVisiblePages - 1)

            if (end - start + 1 < maxVisiblePages) {
                start = Math.max(1, end - maxVisiblePages + 1)
            }

            for (let i = start; i <= end; i++) {
                pages.push(i)
            }
        }

        return pages
    }

    return (
        <div className={cn(
            'flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700',
            className
        )}>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>
                    Showing {startItem}-{endItem} of {totalItems} results
                </span>

                {showPageSizeSelector && onPageSizeChange && (
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white text-sm"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        <span>per page</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={goToPrevious}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 rounded text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>

                <div className="flex gap-1">
                    {getPageNumbers().map((page) => (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className={cn(
                                'px-3 py-1 rounded text-sm transition-colors',
                                page === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            )}
                        >
                            {page}
                        </button>
                    ))}
                </div>

                <button
                    onClick={goToNext}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 rounded text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    )
}
TablePagination.displayName = 'TablePagination'

/**
 * Selection checkbox for table rows
 */
export interface TableSelectionProps {
    checked: boolean
    indeterminate?: boolean
    onChange: (checked: boolean) => void
    className?: string
}

const TableSelection = React.forwardRef<HTMLInputElement, TableSelectionProps>(
    ({ checked, indeterminate, onChange, className, ...props }, ref) => {
        React.useEffect(() => {
            if (ref && 'current' in ref && ref.current) {
                ref.current.indeterminate = indeterminate ?? false
            }
        }, [ref, indeterminate])

        return (
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className={cn(
                    'h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600',
                    'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800',
                    className
                )}
                {...props}
            />
        )
    }
)
TableSelection.displayName = 'TableSelection'

export {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
    TableSkeleton,
    TableEmptyState,
    TablePagination,
    TableSelection,
    tableVariants
} 