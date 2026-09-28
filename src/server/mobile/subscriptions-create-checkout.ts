import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'
import { getStripePriceId } from '@/src/server/subscriptions/price-id'
import { validateMobileAppAuth } from '@/src/lib/mobile-auth'
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

        // Block on *any* non-terminal subscription, matching the web
        // checkout endpoint (src/server/subscriptions/create-checkout.ts):
        // the webhook state machine only allows one live subscription per
        // user. Note this also blocks the upgradeFromTier path above: that
        // flow validates a tier hierarchy but never calls
        // stripe.subscriptions.update() on stripeSubscriptionId, it just
        // starts a brand-new Checkout Session, which would create a second
        // live Stripe subscription rather than a real in-place upgrade.
        // Blocking it here is strictly safer than the prior behavior, not
        // a new regression; a true in-place upgrade needs its own
        // stripe.subscriptions.update() implementation, out of scope here.
        //
        // Accepted residual gap: same TOCTOU as the web endpoint (see its
        // comment) - this check is not atomic with the Stripe session
        // creation below.
        const { data: existingSubscription, error: existingSubscriptionError } = await supabase
            .from('subscriptions')
            .select('id, status, tier')
            .eq('user_id', user.id)
            .not('status', 'in', '(canceled,incomplete_expired,unpaid)')
            .single()

        if (existingSubscriptionError && existingSubscriptionError.code !== 'PGRST116') {
            console.error('❌ [Mobile Subscription API] Error checking existing subscription:', existingSubscriptionError);
            return json(
                { success: false, error: 'Unable to verify subscription status' },
                { status: 500 }
            )
        }

        if (existingSubscription) {
            return json(
                {
                    success: false,
                    error: 'User already has a subscription in progress',
                    currentStatus: existingSubscription.status
                },
                { status: 400 }
            )
        }

        const priceId = getStripePriceId(tier)
        if (!priceId) {
            return json(
                { success: false, error: `Price ID not configured for tier: ${tier}` },
                { status: 500 }
            )
        }

        // Get or create Stripe customer
        const customer = await getOrCreateCustomer(user.email!, user.id)

        console.log('👤 [Mobile Subscription API] Stripe customer:', {
            customerId: customer.id,
            userEmail: user.email
        });

        // Create Stripe checkout session
        const session = await createCheckoutSession({
            customerId: customer.id,
            priceId,
            userId: user.id,
            tier: tier,
            successUrl: successUrl || `evolutioncombatives://subscription/success?tier=${tier}`,
            cancelUrl: cancelUrl || `evolutioncombatives://subscription/cancel`,
        })

        console.log('✅ [Mobile Subscription API] Stripe checkout session created:', {
            sessionId: session.id,
            url: session.url,
            tier,
            amount: session.amount_total,
            currency: session.currency
        });

        const response = {
            success: true,
            data: {
                sessionId: session.id,
                url: session.url!,
                tier,
                price: (session.amount_total || 0) / 100, // Convert from cents
                currency: session.currency || 'usd',
                expiresAt: new Date(session.expires_at * 1000).toISOString()
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
