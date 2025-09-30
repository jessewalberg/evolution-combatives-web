/**
 * Evolution Combatives - Admin Login Page
 * Professional authentication interface for tactical training platform
 * 
 * @description Secure admin login with role validation and professional styling
 * @author Evolution Combatives
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { Input } from '../../src/components/ui/input'
import { Button } from '../../src/components/ui/button'
import { ThemeToggle } from '../../src/providers/ThemeProvider'

// Icons
import { Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react'

// Form validation schema
const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
    rememberMe: z.boolean().optional().default(false)
})

type LoginFormData = z.infer<typeof loginSchema>

// Rate limiting storage
interface LoginAttempt {
    email: string
    timestamp: number
    count: number
}

const MAX_LOGIN_ATTEMPTS = 20
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirectTo') || '/dashboard'

    const [isLoading, setIsLoading] = useState(false)
    const [isLocked, setIsLocked] = useState(false)
    const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0)
    const [showPassword, setShowPassword] = useState(false)

    const supabase = createClientComponentClient()

    // Form setup with validation
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
            rememberMe: false
        }
    })

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    // Check if user has admin role
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('admin_role')
                        .eq('id', session.user.id)
                        .single()

                    if (profile?.admin_role) {
                        router.replace(redirectTo)
                    } else {
                        // User exists but not an admin
                        await supabase.auth.signOut()
                        toast.error('Access denied', {
                            description: 'You do not have admin privileges.'
                        })
                    }
                }
            } catch (error) {
                // Session check failed, user will need to login
                // Error is handled by staying on login page
            }
        }

        checkSession()
    }, [supabase, router, redirectTo])

    // Rate limiting functions
    const getLoginAttempts = (): LoginAttempt[] => {
        if (typeof window === 'undefined') return []
        try {
            const stored = localStorage.getItem('login_attempts')
            return stored ? JSON.parse(stored) : []
        } catch {
            return []
        }
    }

    const setLoginAttempts = (attempts: LoginAttempt[]) => {
        if (typeof window === 'undefined') return
        localStorage.setItem('login_attempts', JSON.stringify(attempts))
    }

    const checkRateLimit = (email: string): boolean => {
        const attempts = getLoginAttempts()
        const now = Date.now()

        // Clean old attempts
        const recentAttempts = attempts.filter(
            attempt => now - attempt.timestamp < LOCKOUT_DURATION
        )
        setLoginAttempts(recentAttempts)

        // Check if user is locked out
        const userAttempts = recentAttempts.find(attempt => attempt.email === email)
        if (userAttempts && userAttempts.count >= MAX_LOGIN_ATTEMPTS) {
            const timeRemaining = LOCKOUT_DURATION - (now - userAttempts.timestamp)
            if (timeRemaining > 0) {
                setLockoutTimeRemaining(Math.ceil(timeRemaining / 1000 / 60))
                setIsLocked(true)
                return false
            }
        }

        return true
    }

    const recordFailedAttempt = (email: string) => {
        const attempts = getLoginAttempts()
        const now = Date.now()

        const existingIndex = attempts.findIndex(attempt => attempt.email === email)

        if (existingIndex >= 0) {
            attempts[existingIndex].count += 1
            attempts[existingIndex].timestamp = now
        } else {
            attempts.push({ email, timestamp: now, count: 1 })
        }

        setLoginAttempts(attempts)

        // Check if user should be locked out
        const userAttempts = attempts[existingIndex >= 0 ? existingIndex : attempts.length - 1]
        if (userAttempts.count >= MAX_LOGIN_ATTEMPTS) {
            setLockoutTimeRemaining(LOCKOUT_DURATION / 1000 / 60)
            setIsLocked(true)
        }
    }

    const clearFailedAttempts = (email: string) => {
        const attempts = getLoginAttempts()
        const filtered = attempts.filter(attempt => attempt.email !== email)
        setLoginAttempts(filtered)
        setIsLocked(false)
        setLockoutTimeRemaining(0)
    }

    // Login submission handler
    const onSubmit = async (data: LoginFormData) => {
        try {
            setIsLoading(true)

            // Check rate limiting
            if (!checkRateLimit(data.email)) {
                toast.error('Too many failed attempts', {
                    description: `Please wait ${lockoutTimeRemaining} minutes before trying again.`
                })
                return
            }

            // Attempt authentication
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password
            })

            if (authError) {
                recordFailedAttempt(data.email)

                if (authError.message.includes('Invalid')) {
                    setError('root', {
                        message: 'Invalid email or password. Please check your credentials and try again.'
                    })
                } else if (authError.message.includes('Email not confirmed')) {
                    setError('root', {
                        message: 'Please check your email and click the confirmation link before signing in.'
                    })
                } else {
                    setError('root', {
                        message: authError.message
                    })
                }
                return
            }

            if (!authData.user) {
                setError('root', { message: 'Authentication failed. Please try again.' })
                return
            }

            // Verify admin role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('admin_role, full_name, last_login_at')
                .eq('id', authData.user.id)
                .single()

            if (profileError || !profile) {
                await supabase.auth.signOut()
                setError('root', { message: 'Unable to verify admin access. Please contact support.' })
                return
            }

            if (!profile.admin_role) {
                await supabase.auth.signOut()
                recordFailedAttempt(data.email)
                setError('root', {
                    message: 'Access denied. This account does not have admin privileges.'
                })
                return
            }

            // Update last login timestamp
            await supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', authData.user.id)

            // Clear failed attempts on successful login
            clearFailedAttempts(data.email)

            // Set remember me preference
            if (data.rememberMe) {
                localStorage.setItem('admin_remember_me', 'true')
            } else {
                localStorage.removeItem('admin_remember_me')
            }

            toast.success('Welcome back!', {
                description: `Signed in as ${profile.full_name || data.email}`
            })

            // Redirect to intended page
            router.replace(redirectTo)

        } catch (error) {
            // Log error for debugging in development only
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.error('Login error:', error)
            }
            setError('root', {
                message: 'An unexpected error occurred. Please try again.'
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Countdown timer for lockout
    useEffect(() => {
        if (lockoutTimeRemaining > 0) {
            const timer = setTimeout(() => {
                setLockoutTimeRemaining(prev => {
                    const newTime = prev - 1
                    if (newTime <= 0) {
                        setIsLocked(false)
                        return 0
                    }
                    return newTime
                })
            }, 60000) // Update every minute

            return () => clearTimeout(timer)
        }
    }, [lockoutTimeRemaining])

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-background">
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_70%)]" />
            </div>

            {/* Theme toggle */}
            <div className="absolute top-4 right-4 z-10">
                <ThemeToggle />
            </div>

            <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                {/* Logo and branding */}
                <div className="text-center mb-8">
                    <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
                        <Shield className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        Evolution Combatives
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Admin Dashboard
                    </p>
                    <p className="text-muted-foreground/70 text-sm mt-2">
                        Professional tactical training platform
                    </p>
                </div>

                {/* Login form */}
                <div className="bg-card border border-border py-8 px-4 shadow-xl rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        {/* Form title */}
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold text-card-foreground mb-2">
                                Sign In
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Access your admin dashboard
                            </p>
                        </div>

                        {/* Error message */}
                        {errors.root && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                                <div className="flex items-center">
                                    <AlertTriangle className="h-5 w-5 text-destructive mr-3" />
                                    <p className="text-destructive text-sm">
                                        {errors.root.message}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Rate limit warning */}
                        {isLocked && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
                                <div className="flex items-center">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
                                    <div>
                                        <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                                            Account temporarily locked
                                        </p>
                                        <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                                            Too many failed attempts. Try again in {lockoutTimeRemaining} minutes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Email field */}
                        <Input
                            {...register('email')}
                            type="email"
                            label="Email Address"
                            placeholder="admin@evolutioncombatives.com"
                            autoComplete="email"
                            required
                            disabled={isLoading || isLocked}
                            error={errors.email?.message}
                            className="w-full"
                        />

                        {/* Password field */}
                        <div className="relative">
                            <Input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                label="Password"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                                disabled={isLoading || isLocked}
                                error={errors.password?.message}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        disabled={isLoading || isLocked}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                }
                                className="w-full"
                            />
                        </div>

                        {/* Remember me and forgot password */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    {...register('rememberMe')}
                                    id="remember-me"
                                    type="checkbox"
                                    disabled={isLoading || isLocked}
                                    className="h-4 w-4 text-primary bg-background border-input rounded focus:ring-primary focus:ring-2"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-muted-foreground">
                                    Remember me
                                </label>
                            </div>

                            <Link
                                href="/forgot-password"
                                className="text-sm text-primary hover:text-primary/80 transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit button */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={isLoading}
                            disabled={isLocked}
                            className="w-full"
                            leftIcon={!isLoading ? <Shield className="h-5 w-5" /> : undefined}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>

                        {/* Additional security notice */}
                        <div className="text-center pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                                Authorized personnel only. All access is monitored and logged.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-muted-foreground/60">
                        © 2024 Evolution Combatives. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
} 