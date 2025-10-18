/**
 * Evolution Combatives - Admin Sign Up Page
 * Professional registration interface for tactical training platform
 *
 * @description Secure admin registration with validation and professional styling
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
const signUpSchema = z.object({
    fullName: z
        .string()
        .min(1, 'Full name is required')
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must not exceed 100 characters'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z
        .string()
        .min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type SignUpFormData = z.infer<typeof signUpSchema>

function SignUpContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirectTo') || '/dashboard'

    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const supabase = createClientComponentClient()

    // Form setup with validation
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError
    } = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirmPassword: ''
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
                    }
                }
            } catch (error) {
                // Session check failed, user will need to sign up
            }
        }

        checkSession()
    }, [supabase, router, redirectTo])

    // Sign up submission handler
    const onSubmit = async (data: SignUpFormData) => {
        try {
            setIsLoading(true)

            // Attempt to create account
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        full_name: data.fullName
                    },
                    emailRedirectTo: `${window.location.origin}/auth/confirm`
                }
            })

            if (authError) {
                if (authError.message.includes('already registered')) {
                    setError('root', {
                        message: 'An account with this email already exists. Please sign in instead.'
                    })
                } else {
                    setError('root', {
                        message: authError.message
                    })
                }
                return
            }

            if (!authData.user) {
                setError('root', { message: 'Registration failed. Please try again.' })
                return
            }

            // Show success message
            toast.success('Account created!', {
                description: 'Please check your email to confirm your account before signing in.'
            })

            // Redirect to login with message
            setTimeout(() => {
                router.push('/login?message=check_email')
            }, 2000)

        } catch (error) {
            // Log error for debugging in development only
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.error('Sign up error:', error)
            }
            setError('root', {
                message: 'An unexpected error occurred. Please try again.'
            })
        } finally {
            setIsLoading(false)
        }
    }

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

                {/* Sign up form */}
                <div className="bg-card border border-border py-8 px-4 shadow-xl rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        {/* Form title */}
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold text-card-foreground mb-2">
                                Create Account
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Register for admin dashboard access
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

                        {/* Full Name field */}
                        <Input
                            {...register('fullName')}
                            type="text"
                            label="Full Name"
                            placeholder="John Doe"
                            autoComplete="name"
                            required
                            disabled={isLoading}
                            error={errors.fullName?.message}
                            className="w-full"
                        />

                        {/* Email field */}
                        <Input
                            {...register('email')}
                            type="email"
                            label="Email Address"
                            placeholder="admin@evolutioncombatives.com"
                            autoComplete="email"
                            required
                            disabled={isLoading}
                            error={errors.email?.message}
                            className="w-full"
                        />

                        {/* Password field */}
                        <div className="relative">
                            <Input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                label="Password"
                                placeholder="Create a strong password"
                                autoComplete="new-password"
                                required
                                disabled={isLoading}
                                error={errors.password?.message}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        disabled={isLoading}
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

                        {/* Confirm Password field */}
                        <div className="relative">
                            <Input
                                {...register('confirmPassword')}
                                type={showConfirmPassword ? 'text' : 'password'}
                                label="Confirm Password"
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                                required
                                disabled={isLoading}
                                error={errors.confirmPassword?.message}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        disabled={isLoading}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                }
                                className="w-full"
                            />
                        </div>

                        {/* Password requirements hint */}
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                            <p className="font-medium mb-1">Password requirements:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>At least 8 characters</li>
                                <li>One uppercase letter</li>
                                <li>One lowercase letter</li>
                                <li>One number</li>
                            </ul>
                        </div>

                        {/* Submit button */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={isLoading}
                            className="w-full"
                            leftIcon={!isLoading ? <Shield className="h-5 w-5" /> : undefined}
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </Button>

                        {/* Sign in link */}
                        <div className="text-center pt-4 border-t border-border">
                            <p className="text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <Link
                                    href="/login"
                                    className="text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </div>

                        {/* Additional security notice */}
                        <div className="text-center">
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

export default function SignUpPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        }>
            <SignUpContent />
        </Suspense>
    )
}
