/**
 * Evolution Combatives Admin Design System Utilities
 * Essential utility functions for the tactical training web interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Utility functions for consistent UI behavior and formatting
 * @author Evolution Combatives
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Subscription tier types from shared package
 */
export type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3'

/**
 * Admin role types
 */
export type AdminRole = 'super_admin' | 'content_admin' | 'support_admin' | null

/**
 * Video processing status types
 */
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error' | 'failed'

/**
 * Badge color variants
 */
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'

// ============================================================================
// CLASS NAME UTILITIES
// ============================================================================

/**
 * Combines class names with Tailwind CSS conflict resolution
 * Merges Tailwind classes intelligently, removing conflicts
 * 
 * @param inputs - Class names to combine
 * @returns Merged class string
 * 
 * @example
 * ```tsx
 * cn('px-4 py-2', 'px-6', 'bg-blue-500') // 'py-2 px-6 bg-blue-500'
 * cn('text-red-500', condition && 'text-green-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}

// ============================================================================
// FILE & DATA FORMATTING UTILITIES
// ============================================================================

/**
 * Converts bytes to human-readable file size format
 * Uses binary (1024) conversion for accurate file sizes
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted file size string
 * 
 * @example
 * ```tsx
 * formatFileSize(1024) // '1.0 KB'
 * formatFileSize(1536000) // '1.5 MB'
 * formatFileSize(2147483648, 2) // '2.00 GB'
 * ```
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Formats video duration in seconds to readable time format
 * Supports both short (MM:SS) and long (HH:MM:SS) formats
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 * 
 * @example
 * ```tsx
 * formatDuration(83) // '1:23'
 * formatDuration(3665) // '1:01:05'
 * formatDuration(0) // '0:00'
 * ```
 */
export function formatDuration(seconds: number): string {
    if (seconds < 0) return '0:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Formats dates consistently for admin interface
 * Provides multiple format options for different contexts
 * 
 * @param date - Date to format
 * @param format - Format type
 * @returns Formatted date string
 * 
 * @example
 * ```tsx
 * formatDate(new Date(), 'short') // 'Jan 15, 2024'
 * formatDate(new Date(), 'long') // 'January 15, 2024 at 2:30 PM'
 * formatDate(new Date(), 'relative') // '2 hours ago'
 * ```
 */
export function formatDate(
    date: Date | string | number,
    format: 'short' | 'long' | 'relative' | 'time' = 'short'
): string {
    const dateObj = new Date(date)

    if (isNaN(dateObj.getTime())) {
        return 'Invalid date'
    }

    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    switch (format) {
        case 'short':
            return dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })

        case 'long':
            return dateObj.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            })

        case 'time':
            return dateObj.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            })

        case 'relative':
            if (diffMinutes < 1) return 'Just now'
            if (diffMinutes < 60) return `${diffMinutes}m ago`
            if (diffHours < 24) return `${diffHours}h ago`
            if (diffDays < 7) return `${diffDays}d ago`
            return formatDate(dateObj, 'short')

        default:
            return formatDate(dateObj, 'short')
    }
}

/**
 * Formats currency values for revenue and subscription displays
 * Supports multiple currencies with proper formatting
 * 
 * @param amount - Amount in cents (Stripe format)
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string
 * 
 * @example
 * ```tsx
 * formatCurrency(999) // '$9.99'
 * formatCurrency(4900) // '$49.00'
 * formatCurrency(0) // '$0.00'
 * ```
 */
export function formatCurrency(
    amount: number,
    currency: string = 'USD'
): string {
    // Convert from cents to dollars
    const dollars = amount / 100

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(dollars)
}

// ============================================================================
// SUBSCRIPTION & ROLE UTILITIES
// ============================================================================

/**
 * Gets the appropriate badge color for subscription tiers
 * Returns Tailwind classes for consistent tier styling
 * 
 * @param tier - Subscription tier
 * @returns Badge variant for styling
 * 
 * @example
 * ```tsx
 * getTierBadgeColor('advanced') // 'warning' (gold)
 * getTierBadgeColor('intermediate') // 'info' (blue)
 * getTierBadgeColor('none') // 'secondary' (gray)
 * ```
 */
export function getTierBadgeColor(tier: SubscriptionTier): BadgeVariant {
    switch (tier) {
        case 'tier3':
            return 'warning' // Gold for highest tier
        case 'tier2':
            return 'info' // Blue for mid tier
        case 'tier1':
            return 'success' // Green for entry tier
        case 'none':
        default:
            return 'secondary' // Gray for no subscription
    }
}

/**
 * Gets the appropriate badge styling for admin roles
 * Returns both variant and display text for admin role badges
 * 
 * @param role - Admin role
 * @returns Badge configuration object
 * 
 * @example
 * ```tsx
 * getAdminRoleBadge('super_admin') // { variant: 'error', text: 'Super Admin' }
 * getAdminRoleBadge('content_admin') // { variant: 'primary', text: 'Content Admin' }
 * ```
 */
export function getAdminRoleBadge(role: AdminRole): {
    variant: BadgeVariant
    text: string
} {
    switch (role) {
        case 'super_admin':
            return { variant: 'error', text: 'Super Admin' }
        case 'content_admin':
            return { variant: 'primary', text: 'Content Admin' }
        case 'support_admin':
            return { variant: 'info', text: 'Support Admin' }
        default:
            return { variant: 'secondary', text: 'User' }
    }
}

/**
 * Gets the appropriate color for video processing status
 * Returns badge variant for video status indicators
 * 
 * @param status - Video processing status
 * @returns Badge variant for status styling
 * 
 * @example
 * ```tsx
 * getVideoStatusColor('ready') // 'success'
 * getVideoStatusColor('processing') // 'warning'
 * getVideoStatusColor('error') // 'error'
 * ```
 */
export function getVideoStatusColor(status: VideoStatus): BadgeVariant {
    switch (status) {
        case 'ready':
            return 'success'
        case 'processing':
        case 'uploading':
            return 'warning'
        case 'error':
        case 'failed':
            return 'error'
        default:
            return 'secondary'
    }
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Truncates text to specified length with ellipsis
 * Preserves word boundaries when possible
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @param preserveWords - Whether to preserve word boundaries
 * @returns Truncated text with ellipsis
 * 
 * @example
 * ```tsx
 * truncateText('This is a long description', 20) // 'This is a long desc...'
 * truncateText('This is a long description', 20, true) // 'This is a long...'
 * ```
 */
export function truncateText(
    text: string,
    maxLength: number,
    preserveWords: boolean = false
): string {
    if (!text || text.length <= maxLength) return text

    if (preserveWords) {
        const truncated = text.slice(0, maxLength)
        const lastSpace = truncated.lastIndexOf(' ')

        if (lastSpace > 0) {
            return truncated.slice(0, lastSpace) + '...'
        }
    }

    return text.slice(0, maxLength) + '...'
}

/**
 * Generates initials from a full name for avatar displays
 * Handles various name formats and edge cases
 * 
 * @param name - Full name to generate initials from
 * @param maxInitials - Maximum number of initials (default: 2)
 * @returns Uppercase initials string
 * 
 * @example
 * ```tsx
 * generateInitials('John Doe') // 'JD'
 * generateInitials('John Michael Doe', 3) // 'JMD'
 * generateInitials('john@example.com') // 'J'
 * ```
 */
export function generateInitials(
    name: string,
    maxInitials: number = 2
): string {
    if (!name || typeof name !== 'string') return ''

    // Handle email addresses
    if (name.includes('@')) {
        return name.charAt(0).toUpperCase()
    }

    // Split name and filter out empty strings
    const nameParts = name.trim().split(/\s+/).filter(part => part.length > 0)

    if (nameParts.length === 0) return ''

    // Take first letter of each name part, up to maxInitials
    return nameParts
        .slice(0, maxInitials)
        .map(part => part.charAt(0).toUpperCase())
        .join('')
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates email address format
 * Uses comprehensive regex pattern for email validation
 * 
 * @param email - Email address to validate
 * @returns Whether email is valid
 * 
 * @example
 * ```tsx
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 * isValidEmail('user+tag@domain.co.uk') // true
 * ```
 */
export function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    return emailRegex.test(email.trim())
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Creates a debounced version of a function
 * Useful for search inputs and API calls
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * ```tsx
 * const debouncedSearch = debounce((query: string) => {
 *   // Perform search
 * }, 300)
 * 
 * // Usage in component
 * const handleSearch = debouncedSearch
 * ```
 */
export function debounce<T extends (...args: never[]) => unknown>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func(...args), delay)
    }
}

// ============================================================================
// TACTICAL THEME UTILITIES
// ============================================================================

/**
 * Gets tactical-themed status text for various states
 * Provides professional, military-style status descriptions
 * 
 * @param status - Status to get text for
 * @returns Professional status text
 * 
 * @example
 * ```tsx
 * getTacticalStatusText('ready') // 'Operational'
 * getTacticalStatusText('processing') // 'In Progress'
 * getTacticalStatusText('error') // 'Mission Failed'
 * ```
 */
export function getTacticalStatusText(status: VideoStatus): string {
    switch (status) {
        case 'ready':
            return 'Operational'
        case 'processing':
            return 'In Progress'
        case 'uploading':
            return 'Deploying'
        case 'error':
        case 'failed':
            return 'Mission Failed'
        default:
            return 'Status Unknown'
    }
}

/**
 * Formats subscription tier names for display
 * Provides consistent tier naming across the admin interface
 * 
 * @param tier - Subscription tier
 * @returns Formatted tier name
 * 
 * @example
 * ```tsx
 * formatTierName('advanced') // 'Advanced Professional'
 * formatTierName('intermediate') // 'Intermediate Operator'
 * formatTierName('none') // 'No Active Subscription'
 * ```
 */
export function formatTierName(tier: SubscriptionTier): string {
    switch (tier) {
        case 'tier3':
            return 'Tier 3 Professional'
        case 'tier2':
            return 'Tier 2 Operator'
        case 'tier1':
            return 'Tier 1 Recruit'
        case 'none':
        default:
            return 'No Active Subscription'
    }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Types are already exported inline above, no need to re-export 