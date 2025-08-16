'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '../../../src/lib/supabase-browser'
import { Card } from '../../../src/components/ui/card'
import { H1, H3, Text, Caption } from '../../../src/components/ui/typography'
import { Spinner } from '../../../src/components/ui/loading'

type VerificationStatus = 'loading' | 'success' | 'error' | 'already_verified'

interface VerificationState {
    status: VerificationStatus
    message: string
    redirectUrl?: string
}

function AuthConfirmContent() {
    const searchParams = useSearchParams()
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

                // Two possible flows:
                // 1. OTP verification -> token_hash & type in query string
                // 2. Email confirmation for sign-up -> access_token / refresh_token etc. in hash fragment
                const token_hash = searchParams.get('token_hash')
                const type = searchParams.get('type') || hashParams.get('type')
                const access_token = hashParams.get('access_token')
                const refresh_token = hashParams.get('refresh_token')

                // Handle error from Supabase
                if (error) {
                    setVerificationState({
                        status: 'error',
                        message: error_description || error || 'An error occurred during verification'
                    })
                    return
                }

                // ========== FLOW 1: OTP verification (token_hash) ==========
                if (token_hash && type) {
                    const { data, error: verifyError } = await supabase.auth.verifyOtp({
                        token_hash,
                        type: type as 'email' | 'recovery'
                    })

                    if (verifyError) {
                        // Check if already verified
                        if (verifyError.message?.includes('already been verified') ||
                            verifyError.message?.includes('expired')) {
                            setVerificationState({
                                status: 'already_verified',
                                message: 'Your email has already been verified. You can now sign in to the app.',
                                redirectUrl: redirect_to || undefined
                            })
                        } else {
                            setVerificationState({
                                status: 'error',
                                message: verifyError.message || 'Email verification failed'
                            })
                        }
                        return
                    }

                    if (data.user) {
                        setVerificationState({
                            status: 'success',
                            message: 'Email verified successfully! You can now sign in to Evolution Combatives.',
                            redirectUrl: redirect_to || undefined
                        })

                        // Auto-redirect to mobile app after 3 seconds
                        if (redirect_to) {
                            setTimeout(() => {
                                window.location.href = redirect_to
                            }, 3000)
                        }
                    } else {
                        setVerificationState({
                            status: 'error',
                            message: 'Verification failed - no user data received'
                        })
                    }
                }

                // ========== FLOW 2: Email signup confirmation (access_token) ==========
                else if (access_token && refresh_token) {
                    const { data, error: sessionErr } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    })

                    if (sessionErr) {
                        setVerificationState({
                            status: 'error',
                            message: sessionErr.message || 'Failed to create session from verification link',
                        })
                        return
                    }

                    if (data.user) {
                        setVerificationState({
                            status: 'success',
                            message: 'Email verified successfully! You can now sign in to Evolution Combatives.',
                            redirectUrl: redirect_to || undefined,
                        })

                        if (redirect_to) {
                            setTimeout(() => {
                                window.location.href = redirect_to
                            }, 3000)
                        }
                    } else {
                        setVerificationState({
                            status: 'error',
                            message: 'Verification failed - no user data received',
                        })
                    }

                } else {
                    setVerificationState({
                        status: 'error',
                        message: 'Invalid verification link - missing required parameters',
                    })
                }
            } catch (error) {
                console.error('Email verification error:', error)
                setVerificationState({
                    status: 'error',
                    message: 'An unexpected error occurred during verification'
                })
            }
        }

        handleEmailVerification()
    }, [searchParams])

    const getStatusIcon = () => {
        switch (verificationState.status) {
            case 'loading':
                return <Spinner size="lg" showLabel={false} />
            case 'success':
                return (
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )
            case 'already_verified':
                return (
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                )
            case 'error':
                return (
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )
        }
    }

    const getStatusColor = () => {
        switch (verificationState.status) {
            case 'success':
                return 'text-green-800'
            case 'already_verified':
                return 'text-blue-800'
            case 'error':
                return 'text-red-800'
            default:
                return 'text-gray-800'
        }
    }

    const getBackgroundColor = () => {
        switch (verificationState.status) {
            case 'success':
                return 'bg-green-50 border-green-200'
            case 'already_verified':
                return 'bg-blue-50 border-blue-200'
            case 'error':
                return 'bg-red-50 border-red-200'
            default:
                return 'bg-gray-50 border-gray-200'
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <Card className={`p-8 text-center ${getBackgroundColor()}`}>
                    {/* Logo/Brand */}
                    <div className="mb-6">
                        <H1 className="text-2xl font-bold text-gray-900 mb-2">
                            Evolution Combatives
                        </H1>
                        <Text className="text-gray-600">
                            Email Verification
                        </Text>
                    </div>

                    {/* Status Icon */}
                    {getStatusIcon()}

                    {/* Status Message */}
                    <H3 className={`text-lg font-semibold mb-4 ${getStatusColor()}`}>
                        {verificationState.status === 'loading' ? 'Verifying...' :
                            verificationState.status === 'success' ? 'Email Verified!' :
                                verificationState.status === 'already_verified' ? 'Already Verified' :
                                    'Verification Failed'}
                    </H3>

                    <Text className={`mb-6 ${getStatusColor()}`}>
                        {verificationState.message}
                    </Text>

                    {/* Actions */}
                    <div className="space-y-3">
                        {verificationState.status === 'success' && verificationState.redirectUrl && (
                            <>
                                <Caption className="text-gray-600 block">
                                    Redirecting to the app in 3 seconds...
                                </Caption>
                                <button
                                    onClick={() => window.location.href = verificationState.redirectUrl!}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                >
                                    Open Evolution Combatives App
                                </button>
                            </>
                        )}

                        {verificationState.status === 'already_verified' && verificationState.redirectUrl && (
                            <button
                                onClick={() => window.location.href = verificationState.redirectUrl!}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                            >
                                Open Evolution Combatives App
                            </button>
                        )}

                        {verificationState.status === 'error' && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                >
                                    Try Again
                                </button>
                                <Caption className="text-gray-600 block">
                                    If the problem persists, please contact support
                                </Caption>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <Caption className="text-gray-500">
                            © 2024 Evolution Combatives. All rights reserved.
                        </Caption>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default function AuthConfirmPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Spinner size="lg" showLabel={false} />
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <AuthConfirmContent />
        </Suspense>
    )
} 