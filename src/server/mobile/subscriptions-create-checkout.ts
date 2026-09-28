import { getStripePriceId } from '@/src/server/subscriptions/price-id'
import { SUBSCRIPTION_PRICING } from '@/src/lib/shared/constants/subscriptionTiers'
import { validateMobileAppAuth } from '@/src/lib/mobile-auth'
import { createAdminClient } from '@/src/lib/supabase'
import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from '@/src/server/subscriptions/checkout-flow'
import { json } from '@/src/lib/http'
import { z } from 'zod'

// Request validation schema
const CreateCheckoutSchema = z.object({
    tier: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    upgradeFromTier: z.enum(['none', 'tier1', 'tier2', 'tier3']).optional(),
    stripeSubscriptionId: z.string().optional(),
})

/**
 * Mobile-specific subscription checkout API endpoint
 * This endpoint bypasses CSRF protection since mobile apps use Bearer token auth
 * and are not subject to CSRF attacks like web browsers
 */
export async function POST({ request }: { request: Request }) {
    console.log('📱 [Mobile Subscription API] Incoming subscription checkout request');

    const authResult = await validateMobileAppAuth(request, 'Mobile Subscription API')
    if ('error' in authResult) {
        return authResult.error
    }

    const { user, supabase } = authResult

    // Get user profile for additional security verification
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, subscription_tier')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        console.error('❌ [Mobile Subscription API] Profile validation failed:', profileError);
        return json(
            { success: false, error: 'User profile not found' },
            { status: 401 }
        )
    }

    try {
        const requestBody = await request.json()
        const validatedData = CreateCheckoutSchema.parse(requestBody)
        const { tier, successUrl, cancelUrl, upgradeFromTier, stripeSubscriptionId } = validatedData

        console.log('💳 [Mobile Subscription API] Processing checkout request:', {
            tier,
            userId: user.id,
            userEmail: user.email,
            currentTier: profile.subscription_tier,
            isUpgrade: !!upgradeFromTier,
            upgradeFromTier,
            hasStripeSubscriptionId: !!stripeSubscriptionId
        });

        // Validate tier hierarchy for upgrades
        if (upgradeFromTier) {
            const tierLevels = { none: 0, tier1: 1, tier2: 2, tier3: 3 }
            const currentLevel = tierLevels[upgradeFromTier]
            const newLevel = tierLevels[tier]

            if (newLevel <= currentLevel) {
                return json(
                    {
                        success: false,
                        error: 'Invalid upgrade: Cannot downgrade or switch to same tier',
                        details: `Cannot upgrade from ${upgradeFromTier} to ${tier}`
                    },
                    { status: 400 }
                )
            }
        }

        const subscriptionGuard = await assertSingleNonTerminalSubscription(supabase, user.id)
        if (!subscriptionGuard.ok) {
            return json(
                {
                    success: false,
                    error: subscriptionGuard.error,
                    ...(subscriptionGuard.currentStatus
                        ? { currentStatus: subscriptionGuard.currentStatus }
                        : {}),
                },
                { status: subscriptionGuard.status },
            )
        }

        const priceId = getStripePriceId(tier)
        if (!priceId) {
            return json(
                { success: false, error: `Price ID not configured for tier: ${tier}` },
                { status: 500 }
            )
        }

        const admin = createAdminClient()
        const checkout = await createReservedCheckoutSession({
            admin,
            userId: user.id,
            userEmail: user.email!,
            tier,
            priceId,
            successUrl: successUrl || `evolutioncombatives://subscription/success?tier=${tier}`,
            cancelUrl: cancelUrl || `evolutioncombatives://subscription/cancel`,
        })

        if (!checkout.ok) {
            return json(
                {
                    success: false,
                    error: checkout.error,
                    ...(checkout.currentStatus ? { currentStatus: checkout.currentStatus } : {}),
                },
                { status: checkout.status },
            )
        }

        console.log('✅ [Mobile Subscription API] Stripe checkout session created:', {
            sessionId: checkout.sessionId,
            url: checkout.url,
            tier,
            reused: checkout.reused,
        });

        const response = {
            success: true,
            data: {
                sessionId: checkout.sessionId,
                url: checkout.url,
                tier,
                price: SUBSCRIPTION_PRICING[tier].monthly,
                currency: 'usd',
                expiresAt: checkout.expiresAt,
            }
        }

        console.log('✅ [Mobile Subscription API] Successfully created checkout session for user:', user.email);

        return json(response)

    } catch (error) {
        console.error('[Mobile Subscription API] Error creating checkout session:', error)

        // Handle validation errors
        if (error instanceof z.ZodError) {
            return json(
                {
                    success: false,
                    error: 'Invalid request data',
                    details: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
                },
                { status: 400 }
            )
        }

        // Handle Stripe errors
        if (error instanceof Error && error.message.includes('stripe')) {
            return json(
                {
                    success: false,
                    error: 'Payment processing error',
                    details: 'Unable to create checkout session. Please try again.'
                },
                { status: 500 }
            )
        }

        return json(
            {
                success: false,
                error: 'Failed to create checkout session',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
