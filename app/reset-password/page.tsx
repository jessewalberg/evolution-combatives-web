/**
 * Evolution Combatives - Reset Password Page
 * Password reset completion interface for admin dashboard
 * 
 * @description Secure password reset completion flow for admin users
 * @author Evolution Combatives
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { Input } from '../../src/components/ui/input'
import { Button } from '../../src/components/ui/button'
import { ThemeToggle } from '../../src/providers/ThemeProvider'

// Icons
import { Shield, Eye, EyeOff, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react'

// Form validation schema
const resetPasswordSchema = z.object({
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

function ResetPasswordContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null)

    const supabase = createClientComponentClient()

    // Form setup with validation
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        watch
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: '',
            confirmPassword: ''
        }
    })

    const password = watch('password')

    // Validate reset token on mount
    useEffect(() => {
        const validateToken = async () => {
            try {
                const { data, error } = await supabase.auth.getSession()

                if (error || !data.session) {
                    // Check if we have the proper URL parameters for password reset
                    const accessToken = searchParams.get('access_token')
                    const refreshToken = searchParams.get('refresh_token')
                    const type = searchParams.get('type')

                    if (type === 'recovery' && accessToken && refreshToken) {
                        // Set the session with the tokens from URL
                        const { error: setSessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        })

                        if (setSessionError) {
                            setIsValidToken(false)
                            return
                        }

                        setIsValidToken(true)
                    } else {
                        setIsValidToken(false)
                    }
                } else {
                    setIsValidToken(true)
                }
            } catch (error) {
                setIsValidToken(false)
            }
        }

        validateToken()
    }, [supabase, searchParams])

    // Password reset submission handler
    const onSubmit = async (data: ResetPasswordFormData) => {
        try {
            setIsLoading(true)

            // Update password
            const { error } = await supabase.auth.updateUser({
                password: data.password
            })

            if (error) {
                if (error.message.includes('same')) {
                    setError('password', {
                        message: 'New password must be different from your current password'
                    })
                } else if (error.message.includes('weak')) {
                    setError('password', {
                        message: 'Password is too weak. Please choose a stronger password'
                    })
                } else {
                    setError('root', {
                        message: error.message
                    })
                }
                return
            }

            // Verify the user still has admin privileges
            const { data: session } = await supabase.auth.getSession()
            if (session.session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('admin_role, full_name')
                    .eq('id', session.session.user.id)
                    .single()

                if (!profile || !profile.admin_role) {
                    await supabase.auth.signOut()
                    router.push('/login?error=access_denied')
                    return
                }

                // Update last login timestamp
                await supabase
                    .from('profiles')
                    .update({ last_login_at: new Date().toISOString() })
                    .eq('id', session.session.user.id)
            }

            setIsSuccess(true)

        } catch (error) {
            // Log error for debugging in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('Password reset error:', error)
            }
            setError('root', {
                message: 'An unexpected error occurred. Please try again.'
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Loading state while validating token
    if (isValidToken === null) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Validating reset link...</p>
                </div>
            </div>
        )
    }

    // Invalid token state
    if (isValidToken === false) {
        return (
            <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
                <div className="absolute inset-0 bg-background">
                    <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
                </div>

                {/* Theme toggle */}
                <div className="absolute top-4 right-4 z-10">
                    <ThemeToggle />
                </div>

                <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-card border border-border py-8 px-4 shadow-xl rounded-lg sm:px-10">
                        <div className="text-center">
                            <div className="mx-auto h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>

                            <h2 className="text-2xl font-semibold text-card-foreground mb-4">
                                Invalid Reset Link
                            </h2>

                            <p className="text-muted-foreground mb-6">
                                This password reset link is invalid or has expired. Please request a new one.
                            </p>

                            <div className="space-y-4">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => router.push('/forgot-password')}
                                >
                                    Request New Reset Link
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => router.push('/login')}
                                    leftIcon={<ArrowLeft className="h-5 w-5" />}
                                >
                                    Back to Login
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Success state
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="absolute inset-0 bg-neutral-950">
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900" />
                </div>

                <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-neutral-900 border border-neutral-800 py-8 px-4 shadow-xl rounded-lg sm:px-10">
                        <div className="text-center">
                            <div className="mx-auto h-16 w-16 bg-success-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="h-8 w-8 text-success-500" />
                            </div>

                            <h2 className="text-2xl font-semibold text-white mb-4">
                                Password Reset Successful
                            </h2>

                            <p className="text-neutral-300 mb-8">
                                Your password has been successfully updated. You can now sign in with your new password.
                            </p>

                            <Button
                                variant="primary"
                                size="lg"
                                className="w-full"
                                onClick={() => router.push('/login')}
                                leftIcon={<Shield className="h-5 w-5" />}
                            >
                                Continue to Login
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Password strength indicator
    const getPasswordStrength = (password: string) => {
        let strength = 0
        if (password.length >= 8) strength++
        if (/[A-Z]/.test(password)) strength++
        if (/[a-z]/.test(password)) strength++
        if (/[0-9]/.test(password)) strength++
        if (/[^A-Za-z0-9]/.test(password)) strength++
        return strength
    }

    const passwordStrength = getPasswordStrength(password)
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
    const strengthColors = ['bg-error-500', 'bg-warning-500', 'bg-warning-400', 'bg-primary-500', 'bg-success-500']

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-neutral-950">
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_70%)]" />
            </div>

            <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
                {/* Logo and branding */}
                <div className="text-center mb-8">
                    <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center mb-4">
                        <Shield className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Evolution Combatives
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Admin Dashboard
                    </p>
                </div>

                {/* Reset form */}
                <div className="bg-neutral-900 border border-neutral-800 py-8 px-4 shadow-xl rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        {/* Form title */}
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold text-white mb-2">
                                Set New Password
                            </h2>
                            <p className="text-neutral-400 text-sm">
                                Choose a strong password for your admin account
                            </p>
                        </div>

                        {/* Error message */}
                        {errors.root && (
                            <div className="bg-error-500/10 border border-error-500/20 rounded-md p-4">
                                <div className="flex items-center">
                                    <AlertTriangle className="h-5 w-5 text-error-500 mr-3" />
                                    <p className="text-error-400 text-sm">
                                        {errors.root.message}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Password field */}
                        <div className="space-y-2">
                            <Input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                label="New Password"
                                placeholder="Enter your new password"
                                autoComplete="new-password"
                                required
                                disabled={isLoading}
                                error={errors.password?.message}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-neutral-400 hover:text-neutral-300 transition-colors"
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

                            {/* Password strength indicator */}
                            {password && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-neutral-400">Password Strength:</span>
                                        <span className={`${passwordStrength >= 4 ? 'text-success-400' : passwordStrength >= 3 ? 'text-primary-400' : passwordStrength >= 2 ? 'text-warning-400' : 'text-error-400'}`}>
                                            {strengthLabels[passwordStrength - 1] || 'Very Weak'}
                                        </span>
                                    </div>
                                    <div className="flex space-x-1">
                                        {[1, 2, 3, 4, 5].map((level) => (
                                            <div
                                                key={level}
                                                className={`h-2 flex-1 rounded-full ${level <= passwordStrength
                                                    ? strengthColors[passwordStrength - 1] || 'bg-error-500'
                                                    : 'bg-neutral-700'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm password field */}
                        <Input
                            {...register('confirmPassword')}
                            type={showConfirmPassword ? 'text' : 'password'}
                            label="Confirm New Password"
                            placeholder="Confirm your new password"
                            autoComplete="new-password"
                            required
                            disabled={isLoading}
                            error={errors.confirmPassword?.message}
                            rightIcon={
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="text-neutral-400 hover:text-neutral-300 transition-colors"
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

                        {/* Submit button */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={isLoading}
                            disabled={passwordStrength < 3}
                            className="w-full"
                            leftIcon={!isLoading ? <Shield className="h-5 w-5" /> : undefined}
                        >
                            {isLoading ? 'Updating Password...' : 'Update Password'}
                        </Button>

                        {/* Password requirements */}
                        <div className="text-xs text-neutral-500 space-y-1">
                            <p className="font-medium">Password must contain:</p>
                            <ul className="space-y-1 ml-4">
                                <li className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${password.length >= 8 ? 'bg-success-500' : 'bg-neutral-600'}`} />
                                    At least 8 characters
                                </li>
                                <li className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${/[A-Z]/.test(password) ? 'bg-success-500' : 'bg-neutral-600'}`} />
                                    One uppercase letter
                                </li>
                                <li className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${/[a-z]/.test(password) ? 'bg-success-500' : 'bg-neutral-600'}`} />
                                    One lowercase letter
                                </li>
                                <li className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${/[0-9]/.test(password) ? 'bg-success-500' : 'bg-neutral-600'}`} />
                                    One number
                                </li>
                                <li className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${/[^A-Za-z0-9]/.test(password) ? 'bg-success-500' : 'bg-neutral-600'}`} />
                                    One special character
                                </li>
                            </ul>
                        </div>

                        {/* Security notice */}
                        <div className="text-center pt-4 border-t border-neutral-800">
                            <p className="text-xs text-neutral-500">
                                Your password will be securely encrypted and stored.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-neutral-600">
                        © 2024 Evolution Combatives. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-neutral-400">Loading...</p>
                </div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    )
}
