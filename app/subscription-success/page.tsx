/**
 * Evolution Combatives - Subscription Success Page
 * Confirmation page shown after successful subscription
 * 
 * @description Success page with redirect back to mobile app
 * @author Evolution Combatives
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { TIER_DISPLAY_INFO } from '@/src/lib/shared/constants/subscriptionTiers';

type SubscriptionTier = 'beginner' | 'intermediate' | 'advanced';

export default function SubscriptionSuccessPage() {
    const searchParams = useSearchParams();
    const [redirecting, setRedirecting] = useState(false);

    const tier = searchParams.get('tier') as SubscriptionTier | null;
    const sessionId = searchParams.get('session_id');

    const redirectToMobileApp = useCallback(() => {
        setRedirecting(true);

        // Deep link back to mobile app
        const mobileAppScheme = process.env.NEXT_PUBLIC_MOBILE_APP_SCHEME || 'evolutioncombatives';
        const deepLink = `${mobileAppScheme}://subscription/success?tier=${tier}&session_id=${sessionId}`;

        // Try to open the mobile app
        window.location.href = deepLink;

        // Fallback: Show instructions if the app doesn't open
        setTimeout(() => {
            setRedirecting(false);
        }, 2000);
    }, [tier, sessionId]);

    // Auto-redirect to mobile app after a few seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            redirectToMobileApp();
        }, 5000); // 5 second delay

        return () => clearTimeout(timer);
    }, [redirectToMobileApp]);

    const displayInfo = tier ? TIER_DISPLAY_INFO[tier] : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
            <Card className="max-w-lg mx-auto p-8 text-center shadow-xl">
                {/* Success Icon */}
                <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                        className="w-10 h-10 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                {/* Success Message */}
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Subscription Activated!
                </h1>

                <p className="text-gray-600 mb-6">
                    Welcome to Evolution Combatives! Your subscription has been successfully activated.
                </p>

                {/* Subscription Details */}
                {displayInfo && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <Badge className="mb-2" variant="secondary">
                            {displayInfo.name} Tier
                        </Badge>
                        <p className="text-sm text-gray-600">
                            {displayInfo.description}
                        </p>
                    </div>
                )}

                {/* What's Next */}
                <div className="text-left mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">What&apos;s next?</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Access to premium training content
                        </li>
                        <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Progress tracking and analytics
                        </li>
                        <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Mobile app with offline viewing
                        </li>
                        {tier === 'intermediate' || tier === 'advanced' ? (
                            <li className="flex items-center">
                                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Instructor Q&A access
                            </li>
                        ) : null}
                    </ul>
                </div>

                {/* Return to App Button */}
                <Button
                    onClick={redirectToMobileApp}
                    disabled={redirecting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                >
                    {redirecting ? 'Opening App...' : 'Return to Evolution Combatives'}
                </Button>

                {/* Auto-redirect Notice */}
                <p className="text-xs text-gray-500 mt-4">
                    You&apos;ll be automatically redirected to the app in a few seconds
                </p>

                {/* Support Link */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        Need help? Contact{' '}
                        <a
                            href="mailto:support@evolutioncombatives.com"
                            className="text-blue-600 hover:underline"
                        >
                            support@evolutioncombatives.com
                        </a>
                    </p>
                </div>
            </Card>
        </div>
    );
}
