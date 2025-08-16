/**
 * Evolution Combatives - Shared Authentication Service
 * Common authentication operations for both React Native and Next.js platforms
 * 
 * @description Centralized authentication service using Supabase client
 * @author Evolution Combatives
 */

import type { User, Session, Provider } from '@supabase/supabase-js'
import type {
    TypedSupabaseClient,
    UserRegistrationData,
    ServiceResponse,
    AuthStateCallback,
} from '../types/services'
import { handleSupabaseError, withRetry, safeQuery } from '../utils/supabase-errors'

/**
 * Authentication service class that provides common auth operations
 * Works with any Supabase client (browser, server, admin, mobile)
 */
export class AuthService {
    constructor(private supabase: TypedSupabaseClient) { }

    // ==========================================
    // AUTHENTICATION OPERATIONS
    // ==========================================

    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<ServiceResponse<{ user: User; session: Session }>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email: email.toLowerCase().trim(),
                    password,
                })

                if (error) throw error

                if (!data.user || !data.session) {
                    throw new Error('Authentication failed - no user or session returned')
                }

                return { user: data.user, session: data.session }
            }, 2, 1000, 'signIn')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'signIn')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Sign up with email and password
     */
    async signUp(
        email: string,
        password: string,
        userData?: UserRegistrationData
    ): Promise<ServiceResponse<{ user: User; session: Session | null }>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.signUp({
                    email: email.toLowerCase().trim(),
                    password,
                    options: {
                        data: userData || {},
                    },
                })

                if (error) throw error

                if (!data.user) {
                    throw new Error('Registration failed - no user returned')
                }

                return { user: data.user, session: data.session }
            }, 2, 1000, 'signUp')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'signUp')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<ServiceResponse<void>> {
        try {
            await withRetry(async () => {
                const { error } = await this.supabase.auth.signOut()
                if (error) throw error
                return undefined
            }, 2, 1000, 'signOut')

            return { data: null, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'signOut')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Get current user
     */
    async getUser(): Promise<ServiceResponse<User>> {
        return safeQuery(async () => {
            const { data: { user }, error } = await this.supabase.auth.getUser()

            if (error) throw error

            if (!user) {
                throw new Error('No authenticated user found')
            }

            return { data: user, error }
        })
    }

    /**
     * Get current session
     */
    async getSession(): Promise<ServiceResponse<Session>> {
        return safeQuery(async () => {
            const { data: { session }, error } = await this.supabase.auth.getSession()

            if (error) throw error

            if (!session) {
                throw new Error('No active session found')
            }

            return { data: session, error }
        })
    }

    /**
     * Reset password
     */
    async resetPassword(email: string, redirectTo?: string): Promise<ServiceResponse<void>> {
        try {
            await withRetry(async () => {
                const { error } = await this.supabase.auth.resetPasswordForEmail(
                    email.toLowerCase().trim(),
                    {
                        redirectTo: redirectTo || undefined,
                    }
                )

                if (error) throw error
                return undefined
            }, 2, 1000, 'resetPassword')

            return { data: null, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'resetPassword')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Update password (requires current session)
     */
    async updatePassword(password: string): Promise<ServiceResponse<User>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.updateUser({
                    password,
                })

                if (error) throw error

                if (!data.user) {
                    throw new Error('Password update failed - no user returned')
                }

                return data.user
            }, 2, 1000, 'updatePassword')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updatePassword')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Update user email (requires current session)
     */
    async updateEmail(email: string): Promise<ServiceResponse<User>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.updateUser({
                    email: email.toLowerCase().trim(),
                })

                if (error) throw error

                if (!data.user) {
                    throw new Error('Email update failed - no user returned')
                }

                return data.user
            }, 2, 1000, 'updateEmail')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'updateEmail')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Refresh current session
     */
    async refreshSession(): Promise<ServiceResponse<{ user: User; session: Session }>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.refreshSession()

                if (error) throw error

                if (!data.user || !data.session) {
                    throw new Error('Session refresh failed')
                }

                return { user: data.user, session: data.session }
            }, 2, 1000, 'refreshSession')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'refreshSession')
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // SESSION MANAGEMENT
    // ==========================================

    /**
     * Listen to authentication state changes
     * Platform-specific implementations should handle the subscription cleanup
     */
    onAuthStateChange(callback: AuthStateCallback) {
        const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
            (event, session) => {
                // Add some basic logging in development
                if (process.env.NODE_ENV === 'development') {
                    console.log('Auth state change:', { event, userId: session?.user?.id })
                }

                callback(event, session)
            }
        )

        return subscription
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const { data: { session } } = await this.supabase.auth.getSession()
            return !!session?.user
        } catch {
            return false
        }
    }

    /**
     * Check if current session is valid
     */
    async isSessionValid(): Promise<boolean> {
        try {
            const { data: { session } } = await this.supabase.auth.getSession()

            if (!session) return false

            // Check if session is expired
            const now = Math.floor(Date.now() / 1000)
            return session.expires_at ? session.expires_at > now : true
        } catch {
            return false
        }
    }

    // ==========================================
    // OAUTH PROVIDERS (Platform-specific)
    // ==========================================

    /**
     * Sign in with OAuth provider
     * Note: Implementation will vary by platform (web vs mobile)
     */
    async signInWithOAuth(
        provider: Provider,
        options?: {
            redirectTo?: string
            scopes?: string
        }
    ): Promise<ServiceResponse<{ url?: string }>> {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: options?.redirectTo,
                    scopes: options?.scopes,
                },
            })

            if (error) throw error

            return { data: { url: data.url }, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, `signInWithOAuth:${provider}`)
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // ADMIN OPERATIONS (Service role only)
    // ==========================================

    /**
     * Get user by ID (admin only)
     */
    async adminGetUser(userId: string): Promise<ServiceResponse<User>> {
        return safeQuery(async () => {
            const { data, error } = await this.supabase.auth.admin.getUserById(userId)

            if (error) throw error

            if (!data.user) {
                throw new Error('User not found')
            }

            return { data: data.user, error }
        })
    }

    /**
     * Delete user (admin only)
     */
    async adminDeleteUser(userId: string): Promise<ServiceResponse<void>> {
        try {
            await withRetry(async () => {
                const { error } = await this.supabase.auth.admin.deleteUser(userId)
                if (error) throw error
                return undefined
            }, 2, 1000, 'adminDeleteUser')

            return { data: null, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'adminDeleteUser')
            return { data: null, error: processedError.message }
        }
    }

    /**
     * Update user metadata (admin only)
     */
    async adminUpdateUser(
        userId: string,
        updates: {
            email?: string
            password?: string
            user_metadata?: Record<string, unknown>
            app_metadata?: Record<string, unknown>
        }
    ): Promise<ServiceResponse<User>> {
        try {
            const result = await withRetry(async () => {
                const { data, error } = await this.supabase.auth.admin.updateUserById(
                    userId,
                    updates
                )

                if (error) throw error

                if (!data.user) {
                    throw new Error('User update failed')
                }

                return data.user
            }, 2, 1000, 'adminUpdateUser')

            return { data: result, error: null }
        } catch (error) {
            const processedError = handleSupabaseError(error, 'adminUpdateUser')
            return { data: null, error: processedError.message }
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Validate email format
     */
    isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    /**
     * Validate password strength
     */
    isValidPassword(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long')
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter')
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter')
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number')
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    /**
     * Get user ID from current session
     */
    async getCurrentUserId(): Promise<string | null> {
        try {
            const { data: { session } } = await this.supabase.auth.getSession()
            return session?.user?.id || null
        } catch {
            return null
        }
    }

    /**
     * Check if user has verified email
     */
    async isEmailVerified(): Promise<boolean> {
        try {
            const { data: { user } } = await this.supabase.auth.getUser()
            return user?.email_confirmed_at !== null
        } catch {
            return false
        }
    }
} 