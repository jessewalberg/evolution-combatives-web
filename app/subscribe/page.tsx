/**
 * Evolution Combatives - Subscription Selection Page
 * Subscription tier selection and checkout initiation for mobile app users
 * 
 * @description Public page for subscription selection, accessed via mobile app redirect
 * @author Evolution Combatives
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import LoadingSpinner from '@/src/components/ui/loading';
import { SUBSCRIPTION_PRICING, SUBSCRIPTION_FEATURES, TIER_DISPLAY_INFO } from '@/src/lib/shared/constants/subscriptionTiers';

type SubscriptionTier = 'beginner' | 'intermediate' | 'advanced';

export default function SubscribePage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Extract parameters from URL (passed from mobile app)
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('email');
    const preselectedTier = searchParams.get('tier') as SubscriptionTier | null;

    useEffect(() => {
        if (preselectedTier && ['beginner', 'intermediate', 'advanced'].includes(preselectedTier)) {
            setSelectedTier(preselectedTier);
        }
    }, [preselectedTier]);

    // Validate required parameters
    if (!userId || !userEmail) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md mx-auto p-6 text-center">
                    <h1 className="text-xl font-semibold text-red-600 mb-4">Invalid Request</h1>
                    <p className="text-gray-600">
                        This page must be accessed through the Evolution Combatives mobile app.
                    </p>
                    <Button
                        onClick={() => router.push('/')}
                        className="mt-4"
                    >
                        Go to Dashboard
                    </Button>
                </Card>
            </div>
        );
    }

    const handleSubscribe = async (tier: SubscriptionTier) => {
        if (!userId || !userEmail) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/subscriptions/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tier,
                    userId,
                    userEmail,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            // Redirect to Stripe Checkout
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL received');
            }

        } catch (err) {
            console.error('Subscription error:', err);
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(false);
        }
    };

    const tiers: SubscriptionTier[] = ['beginner', 'intermediate', 'advanced'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-4">
                        Choose Your Training Level
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                        Select the subscription tier that matches your training goals and unlock professional tactical training content.
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="max-w-md mx-auto mb-8">
                        <Card className="p-4 bg-red-50 border-red-200">
                            <p className="text-red-600 text-center">{error}</p>
                            <Button
                                onClick={() => setError(null)}
                                variant="outline"
                                className="mt-2 w-full"
                            >
                                Try Again
                            </Button>
                        </Card>
                    </div>
                )}

                {/* Subscription Tiers */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {tiers.map((tier) => {
                        const pricing = SUBSCRIPTION_PRICING[tier];
                        const features = SUBSCRIPTION_FEATURES[tier];
                        const displayInfo = TIER_DISPLAY_INFO[tier];
                        const isSelected = selectedTier === tier;
                        const isPopular = displayInfo.popular;

                        return (
                            <Card
                                key={tier}
                                className={`relative p-6 transition-all duration-200 cursor-pointer ${isSelected
                                    ? 'ring-2 ring-blue-500 shadow-xl scale-105'
                                    : 'hover:shadow-lg hover:scale-102'
                                    } ${isPopular ? 'border-blue-500' : 'border-gray-200'}`}
                                onClick={() => setSelectedTier(tier)}
                            >
                                {/* Popular Badge */}
                                {isPopular && (
                                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white">
                                        Most Popular
                                    </Badge>
                                )}

                                {/* Tier Header */}
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                        {displayInfo.name}
                                    </h3>
                                    <p className="text-gray-600 mb-4">
                                        {displayInfo.description}
                                    </p>
                                    <div className="text-4xl font-bold text-gray-900 mb-1">
                                        ${pricing.monthly}
                                        <span className="text-lg font-normal text-gray-600">/month</span>
                                    </div>
                                </div>

                                {/* Features List */}
                                <ul className="space-y-3 mb-8">
                                    {features.map((feature, index) => (
                                        <li key={index} className="flex items-start">
                                            <svg
                                                className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <span className="text-gray-700">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Subscribe Button */}
                                <Button
                                    onClick={() => handleSubscribe(tier)}
                                    disabled={loading}
                                    className={`w-full py-3 text-lg font-semibold transition-colors ${isPopular
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-gray-800 hover:bg-gray-900 text-white'
                                        }`}
                                >
                                    {loading ? (
                                        <LoadingSpinner size="sm" className="mr-2" />
                                    ) : null}
                                    {loading ? 'Processing...' : `Subscribe to ${displayInfo.name}`}
                                </Button>
                            </Card>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="text-center mt-12 text-gray-400">
                    <p className="mb-2">
                        All subscriptions include a 30-day money-back guarantee
                    </p>
                    <p className="text-sm">
                        You can cancel or change your subscription at any time
                    </p>
                </div>
            </div>
        </div>
    );
}
