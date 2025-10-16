/**
 * Evolution Combatives - Forgot Password Page
 * Password reset request interface for admin dashboard
 * 
 * @description Secure password reset flow for admin users
 * @author Evolution Combatives
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { Input } from '../../src/components/ui/input'
import { Button } from '../../src/components/ui/button'
import { ThemeToggle } from '../../src/providers/ThemeProvider'

// Icons
import { Shield, ArrowLeft, Mail, CheckCircle } from 'lucide-react'

// Form validation schema
const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform(val => val.toLowerCase().trim())
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const supabase = createClientComponentClient()

    // Form setup with validation
    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        getValues
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: ''
        }
    })

    // Password reset submission handler
    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setIsLoading(true)

            // First check if user exists and has admin role
            const { data: profile } = await supabase
                .from('profiles')
                .select('admin_role, full_name')
                .eq('email', data.email)
                .single()

            if (!profile || !profile.admin_role) {
                // Don't reveal whether the email exists for security
                setIsSuccess(true)
                return
            }

            // Send password reset email
            const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
                redirectTo: `${window.location.origin}/reset-password`
            })

            if (error) {
                if (error.message.includes('rate limit')) {
                    setError('root', {
                        message: 'Too many password reset requests. Please wait before trying again.'
                    })
                } else {
                    setError('root', {
                        message: 'Unable to send password reset email. Please try again later.'
                    })
                }
                return
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

    if (isSuccess) {
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
                    {/* Success message */}
                    <div className="bg-card border border-border py-8 px-4 shadow-xl rounded-lg sm:px-10">
                        <div className="text-center">
                            <div className="mx-auto h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>

                            <h2 className="text-2xl font-semibold text-card-foreground mb-4">
                                Check Your Email
                            </h2>

                            <p className="text-muted-foreground mb-6">
                                If an admin account exists with email <strong>{getValues('email')}</strong>,
                                we&apos;ve sent password reset instructions to that address.
                            </p>

                            <p className="text-muted-foreground/80 text-sm mb-8">
                                Please check your email and click the reset link. If you don&apos;t see the email,
                                check your spam folder or try again.
                            </p>

                            <div className="space-y-4">
                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => router.push('/login')}
                                    leftIcon={<ArrowLeft className="h-5 w-5" />}
                                >
                                    Back to Login
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => setIsSuccess(false)}
                                >
                                    Send Another Email
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
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
                </div>

                {/* Reset form */}
                <div className="bg-card border border-border py-8 px-4 shadow-xl rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        {/* Form title */}
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold text-card-foreground mb-2">
                                Reset Password
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Enter your admin email address and we&apos;ll send you a link to reset your password
                            </p>
                        </div>

                        {/* Error message */}
                        {errors.root && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                                <p className="text-destructive text-sm">
                                    {errors.root.message}
                                </p>
                            </div>
                        )}

                        {/* Email field */}
                        <Input
                            {...register('email')}
                            type="email"
                            label="Admin Email Address"
                            placeholder="admin@evolutioncombatives.com"
                            autoComplete="email"
                            required
                            disabled={isLoading}
                            error={errors.email?.message}
                            className="w-full"
                            leftIcon={<Mail className="h-5 w-5" />}
                        />

                        {/* Submit button */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={isLoading}
                            className="w-full"
                            leftIcon={!isLoading ? <Mail className="h-5 w-5" /> : undefined}
                        >
                            {isLoading ? 'Sending Reset Email...' : 'Send Reset Email'}
                        </Button>

                        {/* Back to login */}
                        <div className="text-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center text-sm text-primary-400 hover:text-primary-300 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Login
                            </Link>
                        </div>

                        {/* Security notice */}
                        <div className="text-center pt-4 border-t border-neutral-800">
                            <p className="text-xs text-neutral-500">
                                For security reasons, we don&apos;t confirm whether an email address exists in our system.
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
