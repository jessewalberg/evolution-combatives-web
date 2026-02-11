'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { toast } from 'sonner'
import { createBrowserClient } from '../../src/lib/supabase-browser'
import { Card } from '../../src/components/ui/card'
import { Input } from '../../src/components/ui/input'
import { Button } from '../../src/components/ui/button'
import { ThemeToggle } from '../../src/providers/ThemeProvider'
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'

const verifySchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address')
        .transform((val) => val.toLowerCase().trim()),
    code: z
        .string()
        .min(1, 'Verification code is required')
        .regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})

function VerifyEmailContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialEmail = searchParams.get('email') ?? ''

    const [email, setEmail] = useState(initialEmail)
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [isVerified, setIsVerified] = useState(false)

    const supabase = createBrowserClient()

    const handleVerify = async () => {
        setError(null)

        const validated = verifySchema.safeParse({ email, code })
        if (!validated.success) {
            setError(validated.error.errors[0]?.message || 'Invalid verification details')
            return
        }

        setIsVerifying(true)

        try {
            let result = await supabase.auth.verifyOtp({
                email: validated.data.email,
                token: validated.data.code,
                type: 'signup',
            })

            if (result.error) {
                // Supabase can classify signup OTP as `email` depending on config
                result = await supabase.auth.verifyOtp({
                    email: validated.data.email,
                    token: validated.data.code,
                    type: 'email',
                })
            }

            if (result.error) {
                throw result.error
            }

            setIsVerified(true)
            await supabase.auth.signOut()

            toast.success('Email verified', {
                description: 'Verification complete. You can now sign in.',
            })

            setTimeout(() => {
                router.push(`/login?message=email_verified&email=${encodeURIComponent(validated.data.email)}`)
            }, 1000)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Verification failed'
            setError(message)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleResend = async () => {
        setError(null)

        const parsedEmail = z.string().email('Please enter a valid email').safeParse(email.trim().toLowerCase())
        if (!parsedEmail.success) {
            setError(parsedEmail.error.errors[0]?.message || 'Invalid email')
            return
        }

        setIsResending(true)
        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: parsedEmail.data,
            })

            if (resendError) {
                throw resendError
            }

            toast.success('Verification code sent', {
                description: 'A new code has been sent to your email.',
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to resend code'
            setError(message)
        } finally {
            setIsResending(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
            <div className="absolute inset-0 bg-background">
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_70%)]" />
            </div>

            <div className="absolute top-4 right-4 z-10">
                <ThemeToggle />
            </div>

            <div className="relative max-w-md w-full">
                <Card className="p-8 border-border">
                    <div className="text-center mb-6">
                        <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
                            {isVerified ? (
                                <CheckCircle className="h-8 w-8 text-primary-foreground" />
                            ) : (
                                <Shield className="h-8 w-8 text-primary-foreground" />
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Verify Your Email</h1>
                        <p className="text-muted-foreground text-sm">
                            Enter the 6-digit code sent to your inbox.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            type="email"
                            label="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            disabled={isVerifying || isResending || isVerified}
                        />

                        <Input
                            type="text"
                            label="Verification Code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            disabled={isVerifying || isResending || isVerified}
                        />

                        <Button
                            onClick={handleVerify}
                            disabled={isVerifying || isResending || isVerified}
                            className="w-full"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify Email'}
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={handleResend}
                            disabled={isVerifying || isResending || isVerified}
                            className="w-full"
                        >
                            {isResending ? 'Sending...' : 'Resend Code'}
                        </Button>

                        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
                            Back to Sign In
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <p className="text-muted-foreground">Loading verification...</p>
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    )
}
