/**
 * Evolution Combatives - Shared Supabase Error Handling
 * Common error handling utilities for both React Native and Next.js platforms
 * 
 * @description Centralized error handling and formatting for Supabase operations
 * @author Evolution Combatives
 */

import type { AuthError, PostgrestError } from '@supabase/supabase-js'

/**
 * Supabase error types
 */
export interface SupabaseError {
    message: string
    code?: string
    details?: string
    hint?: string
}

/**
 * Custom error class for Evolution Combatives operations
 */
export class EvolutionCombativesError extends Error {
    public readonly code: string
    public readonly details?: string
    public readonly hint?: string

    constructor(message: string, code = 'UNKNOWN_ERROR', details?: string, hint?: string) {
        super(message)
        this.name = 'EvolutionCombativesError'
        this.code = code
        this.details = details
        this.hint = hint
    }
}

/**
 * Check if error is a Supabase authentication error
 */
export const isAuthError = (error: unknown): error is AuthError => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AuthError'
    )
}

/**
 * Check if error is a Supabase Postgrest error
 */
export const isPostgrestError = (error: unknown): error is PostgrestError => {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error &&
        'details' in error
    )
}

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
        return (
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('connection') ||
            error.message.includes('timeout')
        )
    }
    return false
}

/**
 * Format error message for user display
 */
export const formatErrorMessage = (error: unknown): string => {
    if (isAuthError(error)) {
        return formatAuthErrorMessage(error)
    }

    if (isPostgrestError(error)) {
        return formatPostgrestErrorMessage(error)
    }

    if (isNetworkError(error)) {
        return 'Network connection error. Please check your internet connection and try again.'
    }

    if (error instanceof EvolutionCombativesError) {
        return error.message
    }

    if (error instanceof Error) {
        return error.message
    }

    return 'An unexpected error occurred. Please try again.'
}

/**
 * Format authentication error messages
 */
export const formatAuthErrorMessage = (error: AuthError): string => {
    switch (error.message) {
        case 'Invalid login credentials':
            return 'Invalid email or password. Please check your credentials and try again.'

        case 'Email not confirmed':
            return 'Please check your email and click the confirmation link before signing in.'

        case 'User not found':
            return 'No account found with this email address.'

        case 'Password is too weak':
            return 'Password must be at least 8 characters long and include a mix of letters and numbers.'

        case 'Email rate limit exceeded':
            return 'Too many email requests. Please wait a few minutes before trying again.'

        case 'Signup disabled':
            return 'Account registration is currently disabled. Please contact support.'

        case 'User already registered':
            return 'An account with this email already exists. Try signing in instead.'

        default:
            return error.message || 'Authentication error occurred.'
    }
}

/**
 * Format database error messages
 */
export const formatPostgrestErrorMessage = (error: PostgrestError): string => {
    switch (error.code) {
        case 'PGRST116':
            return 'No data found matching your request.'

        case 'PGRST204':
            return 'The requested resource was not found.'

        case '23505':
            return 'This record already exists. Please use different values.'

        case '23503':
            return 'Cannot delete this record as it is referenced by other data.'

        case '42501':
            return 'You do not have permission to perform this action.'

        case '42P01':
            return 'Database table not found. Please contact support.'

        case '08006':
            return 'Database connection failed. Please try again.'

        default:
            // For development, show detailed error. For production, show generic message
            if (process.env.NODE_ENV === 'development') {
                return `Database error (${error.code}): ${error.message}`
            }
            return 'A database error occurred. Please try again or contact support if the problem persists.'
    }
}

/**
 * Handle Supabase errors with logging and formatting
 */
export const handleSupabaseError = (error: unknown, context?: string): EvolutionCombativesError => {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Supabase error:', {
            error,
            context,
            timestamp: new Date().toISOString(),
        })
    }

    const message = formatErrorMessage(error)

    if (isAuthError(error)) {
        return new EvolutionCombativesError(
            message,
            'AUTH_ERROR',
            error.message,
            context
        )
    }

    if (isPostgrestError(error)) {
        return new EvolutionCombativesError(
            message,
            error.code,
            error.details,
            error.hint || context
        )
    }

    if (isNetworkError(error)) {
        return new EvolutionCombativesError(
            message,
            'NETWORK_ERROR',
            error instanceof Error ? error.message : undefined,
            context
        )
    }

    return new EvolutionCombativesError(
        message,
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : String(error),
        context
    )
}

/**
 * Retry wrapper for Supabase operations
 */
export const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    context?: string
): Promise<T> => {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error

            // Don't retry auth errors or client errors
            if (isAuthError(error) || (isPostgrestError(error) && error.code.startsWith('4'))) {
                throw handleSupabaseError(error, context)
            }

            // Don't retry on final attempt
            if (attempt === maxRetries) {
                break
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
    }

    throw handleSupabaseError(lastError, context)
}

/**
 * Safe query wrapper that always returns a consistent format
 */
export const safeQuery = async <T>(
    queryFn: () => Promise<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; error: string | null }> => {
    try {
        const result = await queryFn()

        if (result.error) {
            const processedError = handleSupabaseError(result.error)
            return {
                data: null,
                error: processedError.message
            }
        }

        return {
            data: result.data,
            error: null
        }
    } catch (error) {
        const processedError = handleSupabaseError(error)
        return {
            data: null,
            error: processedError.message
        }
    }
}

/**
 * Error codes for common Evolution Combatives operations
 */
export const ErrorCodes = {
    // Authentication
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    WEAK_PASSWORD: 'WEAK_PASSWORD',

    // Authorization
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
    ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED',

    // Content
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
    CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
    CONTENT_UNAVAILABLE: 'CONTENT_UNAVAILABLE',

    // Subscription
    SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
    PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
    TIER_UPGRADE_REQUIRED: 'TIER_UPGRADE_REQUIRED',

    // System
    NETWORK_ERROR: 'NETWORK_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes] 