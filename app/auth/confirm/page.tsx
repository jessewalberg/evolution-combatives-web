'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../src/lib/supabase-browser'
import { Card } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Shield, CheckCircle, AlertCircle } from 'lucide-react'
import { Spinner } from '../../../src/components/ui/loading'

type VerificationStatus = 'loading' | 'success' | 'error' | 'already_verified'

interface VerificationState {
    status: VerificationStatus
    message: string
    redirectUrl?: string
    debugInfo?: string
}

function AuthConfirmContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [verificationState, setVerificationState] = useState<VerificationState>({
        status: 'loading',
        message: 'Verifying your email...'
    })

    useEffect(() => {
        const handleEmailVerification = async () => {
            try {
                const supabase = createBrowserClient()

                // Query params
                const redirect_to = searchParams.get('redirect_to')
                const error = searchParams.get('error')
                const error_description = searchParams.get('error_description')

                // Parse hash fragment (after #)
                const hashParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.hash.slice(1) : '')

                // Debug info
                const debugInfo = {
                    queryParams: Object.fromEntries(searchParams.entries()),
                    hashParams: Object.fromEntries(hashParams.entries()),
                    fullUrl: typeof window !== 'undefined' ? window.location.href : ''
                }
                console.log('Email verification params:', debugInfo)

                // Three possible flows:
                // 1. OTP verification -> token_hash & type in query string
                // 2. Email confirmation for sign-up -> access_token / refresh_token in hash fragment  
                // 3. New signup flow -> code in hash fragment
                const token_hash = searchParams.get('token_hash')
                const type = searchParams.get('type') || hashParams.get('type')
                const access_token = hashParams.get('access_token')
                const refresh_token = hashParams.get('refresh_token')
                const code = searchParams.get('code')

                // Handle error from Supabase
                if (error) {
                    setVerificationState({
                        status: 'error',
                        message: error_description || error || 'An error occurred during verification',
                        debugInfo: JSON.stringify(debugInfo, null, 2)
                    })
                    return
                }

                // ========== FLOW 1: PKCE flow with code ==========
                if (code) {
                    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

                    if (exchangeError) {
                        // Handle missing code verifier error specifically
                        if (exchangeError.message?.includes('code verifier') || exchangeError.message?.includes('pkce')) {
                            // IMPORTANT: Email is already verified at this point!
                            // The PKCE flow failed, but the email verification succeeded
                            setVerificationState({
                                status: 'already_verified',
                                message: 'Your email has been verified! You can now sign in to your account.',
                                redirectUrl: '/login',
                                debugInfo: JSON.stringify({
                                    ...debugInfo,
                                    note: 'Email verification succeeded, but session creation failed due to PKCE. User should login manually.',
                                    error: exchangeError.message
                                }, null, 2)
                            })
                        } else {
                            setVerificationState({
                                status: 'error',
                                message: exchangeError.message || 'Failed to verify email',
                                debugInfo: JSON.stringify(debugInfo, null, 2)
                            })
                        }
                        return
                    }

                    if (data.session) {
                        setVerificationState({
                            status: 'success',
                            message: 'Email verified successfully! Redirecting to dashboard...'
                        })

                        // Redirect to dashboard after brief delay
                        setTimeout(() => {
                            router.push('/dashboard')
                        }, 2000)
                    }
                    return
                }

                // ========== FLOW 2: OTP verification (token_hash) ==========
                if (token_hash && type) {
                    const { data, error: verifyError } = await supabase.auth.verifyOtp({
                        token_hash,
                        type: type as 'email' | 'signup' | 'recovery'
                    })

                    if (verifyError) {
                        // Check if already verified
                        if (verifyError.message?.includes('already been verified') ||
                            verifyError.message?.includes('expired')) {
                            setVerificationState({
                                status: 'already_verified',
                                message: 'Your email has already been verified. You can now sign in.',
                                redirectUrl: redirect_to || '/login'
                            })
                        } else {
                            setVerificationState({
                                status: 'error',
                                message: verifyError.message || 'Email verification failed',
                                debugInfo: JSON.stringify(debugInfo, null, 2)
                            })
                        }
                        return
                    }

                    if (data.session) {
                        setVerificationState({
                            status: 'success',
                            message: 'Email verified successfully! Redirecting to dashboard...'
                        })

                        // Redirect to dashboard
                        setTimeout(() => {
                            router.push('/dashboard')
                        }, 2000)
                    } else {
                        setVerificationState({
                            status: 'error',
                            message: 'Verification failed - no session created',
                            debugInfo: JSON.stringify(debugInfo, null, 2)
                        })
                    }
                    return
                }

                // ========== FLOW 3: Email signup confirmation (access_token) ==========
                if (access_token && refresh_token) {
                    const { data, error: sessionErr } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    })

                    if (sessionErr) {
                        setVerificationState({
                            status: 'error',
                            message: sessionErr.message || 'Failed to create session from verification link',
                            debugInfo: JSON.stringify(debugInfo, null, 2)
                        })
                        return
                    }

                    if (data.session) {
                        setVerificationState({
                            status: 'success',
                            message: 'Email verified successfully! Redirecting to dashboard...'
                        })

                        // Redirect to dashboard
                        setTimeout(() => {
                            router.push('/dashboard')
                        }, 2000)
                    } else {
                        setVerificationState({
                            status: 'error',
                            message: 'Verification failed - no session created',
                            debugInfo: JSON.stringify(debugInfo, null, 2)
                        })
                    }
                    return
                }

                // No valid parameters found
                setVerificationState({
                    status: 'error',
                    message: 'Invalid verification link - missing required parameters',
                    debugInfo: JSON.stringify(debugInfo, null, 2)
                })

            } catch (error) {
                console.error('Email verification error:', error)
                setVerificationState({
                    status: 'error',
                    message: 'An unexpected error occurred during verification'
                })
            }
        }

        handleEmailVerification()
    }, [searchParams, router])

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-background">
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_70%)]" />
            </div>

            <div className="relative max-w-md w-full">
                <Card className="p-8 text-center border-border">
                    {/* Logo/Brand */}
                    <div className="mb-6">
                        <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
                            <Shield className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Evolution Combatives
                        </h1>
                        <p className="text-muted-foreground">
                            Email Verification
                        </p>
                    </div>

                    {/* Status Icon */}
                    <div className="mb-6">
                        {verificationState.status === 'loading' && (
                            <Spinner size="lg" showLabel={false} />
                        )}
                        {verificationState.status === 'success' && (
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        )}
                        {verificationState.status === 'already_verified' && (
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        )}
                        {verificationState.status === 'error' && (
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-destructive" />
                            </div>
                        )}
                    </div>

                    {/* Status Message */}
                    <h3 className={`text-lg font-semibold mb-4 ${verificationState.status === 'success' ? 'text-green-500' :
                        verificationState.status === 'already_verified' ? 'text-green-500' :
                            verificationState.status === 'error' ? 'text-destructive' :
                                'text-foreground'
                        }`}>
                        {verificationState.status === 'loading' ? 'Verifying...' :
                            verificationState.status === 'success' ? 'Email Verified!' :
                                verificationState.status === 'already_verified' ? 'Email Verified!' :
                                    'Verification Failed'}
                    </h3>

                    <p className="text-muted-foreground mb-6">
                        {verificationState.message}
                    </p>

                    {/* Debug info in development */}
                    {process.env.NODE_ENV === 'development' && verificationState.debugInfo && (
                        <details className="mb-6 text-left">
                            <summary className="text-xs text-muted-foreground cursor-pointer mb-2">
                                Debug Information
                            </summary>
                            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                                {verificationState.debugInfo}
                            </pre>
                        </details>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        {verificationState.status === 'success' && (
                            <p className="text-sm text-muted-foreground">
                                Redirecting to dashboard...
                            </p>
                        )}

                        {verificationState.status === 'already_verified' && verificationState.redirectUrl && (
                            <Button
                                onClick={() => router.push(verificationState.redirectUrl!)}
                                variant="primary"
                                size="lg"
                                className="w-full"
                            >
                                {verificationState.redirectUrl.includes('login') ? 'Go to Login' :
                                    verificationState.redirectUrl.includes('dashboard') ? 'Go to Dashboard' : 'Continue'}
                            </Button>
                        )}

                        {verificationState.status === 'error' && (
                            <div className="space-y-3">
                                {verificationState.message?.includes('same browser') ? (
                                    <>
                                        <div className="bg-muted/50 border border-border rounded-lg p-4 text-left">
                                            <p className="text-sm text-foreground font-medium mb-2">
                                                To fix this issue:
                                            </p>
                                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                                <li>Open this link in the browser where you signed up</li>
                                                <li>Or, sign up again from this browser</li>
                                                <li>Check your email and click the link</li>
                                            </ol>
                                        </div>
                                        <Button
                                            onClick={() => router.push('/sign-up')}
                                            variant="primary"
                                            size="lg"
                                            className="w-full"
                                        >
                                            Sign Up Again
                                        </Button>
                                        <Button
                                            onClick={() => router.push('/login')}
                                            variant="outline"
                                            size="lg"
                                            className="w-full"
                                        >
                                            Go to Login
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={() => window.location.reload()}
                                            variant="secondary"
                                            size="lg"
                                            className="w-full"
                                        >
                                            Try Again
                                        </Button>
                                        <Button
                                            onClick={() => router.push('/login')}
                                            variant="outline"
                                            size="lg"
                                            className="w-full"
                                        >
                                            Go to Login
                                        </Button>
                                    </>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    If the problem persists, please contact support
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <p className="text-xs text-muted-foreground/60">
                            © 2024 Evolution Combatives. All rights reserved.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default function AuthConfirmPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center relative">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-background">
                    <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(59,130,246,0.1),transparent_70%)]" />
                </div>

                <div className="relative text-center">
                    <Spinner size="lg" showLabel={false} />
                    <p className="mt-4 text-muted-foreground">Loading...</p>
                </div>
            </div>
        }>
            <AuthConfirmContent />
        </Suspense>
    )
} 