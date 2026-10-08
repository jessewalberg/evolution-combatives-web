/**
 * Evolution Combatives - Create Stripe Checkout Session API (Web)
 * Handles creation of Stripe checkout sessions for subscription payments
 * 
 * This endpoint uses cookie-based session auth for web clients.
 * Mobile clients should use /api/mobile/subscriptions/create-checkout instead.
 *
 * @description Secure API endpoint for initiating subscription payments
 * @author Evolution Combatives
 */

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe';
import { SUBSCRIPTION_PRICING, type SubscriptionTier } from '@/src/lib/shared/constants/subscriptionTiers';
import { createAdminClient } from '@/src/lib/supabase';
import { validateSessionAuth } from '@/src/lib/api-auth';
import { json } from '@/src/lib/http';
import { z } from 'zod';

// Request validation schema - userId/userEmail not accepted from body
const CreateCheckoutSchema = z.object({
    tier: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
});

export async function POST({ request: _request }: { request: Request }): Promise<Response> {
    // Validate cookie session - user identity derived from session, not request body
    const authResult = await validateSessionAuth();
    if ('error' in authResult) {
        return authResult.error;
    }
    
    const { user: sessionUser } = authResult;
    const userId = sessionUser.userId;
    const userEmail = sessionUser.email;
    
    let tier: SubscriptionTier | undefined;
    
    try {
        const body = await _request.json();
        const validatedData = CreateCheckoutSchema.parse(body);

        tier = validatedData.tier;
        const { successUrl, cancelUrl } = validatedData;

        const supabase = createAdminClient();

        // Check if user already has an active subscription
        const { data: existingSubscription } = await supabase
            .from('subscriptions')
            .select('id, status, tier')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (existingSubscription) {
            return json(
                {
                    error: 'User already has an active subscription',
                    currentTier: existingSubscription.tier
                },
                { status: 400 }
            );
        }

        // Get Stripe price ID for the tier
        const priceId = SUBSCRIPTION_PRICING[tier].stripePriceId;
        if (!priceId) {
            return json(
                { error: `Price ID not configured for tier: ${tier}` },
                { status: 500 }
            );
        }

        // Get or create Stripe customer
        const customer = await getOrCreateCustomer(userEmail, userId);

        // Default URLs - redirect back to mobile app
        const defaultSuccessUrl = successUrl || `${(process.env.MOBILE_APP_SCHEME || 'evolutioncombatives')}://subscription/success?tier=${tier}`;
        const defaultCancelUrl = cancelUrl || `${(process.env.MOBILE_APP_SCHEME || 'evolutioncombatives')}://subscription/cancel`;

        // Create checkout session
        const session = await createCheckoutSession({
            priceId,
            customerId: customer.id,
            userId,
            tier,
            successUrl: defaultSuccessUrl,
            cancelUrl: defaultCancelUrl,
        });

        // Log the checkout session creation (no PII)
        console.log('✅ Checkout session created:', {
            userId,
            tier,
            sessionId: session.id,
            timestamp: new Date().toISOString()
        });

        return json({
            sessionId: session.id,
            url: session.url,
            tier,
            price: SUBSCRIPTION_PRICING[tier].monthly,
        });

    } catch (error) {
        console.error('❌ Error creating checkout session:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            tier,
            userId,
            timestamp: new Date().toISOString()
        });

        // Handle validation errors
        if (error instanceof z.ZodError) {
            return json(
                {
                    error: 'Invalid request data',
                    details: error.issues
                },
                { status: 400 }
            );
        }

        // Handle Stripe errors
        if (error instanceof Error && error.message.includes('Stripe')) {
            return json(
                { error: 'Payment processing error' },
                { status: 500 }
            );
        }

        return json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function GET() {
    return json({
        status: 'ok',
        service: 'checkout-session-creation',
        timestamp: new Date().toISOString(),
    });
}
