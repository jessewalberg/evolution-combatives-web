/**
 * Evolution Combatives - Create Stripe Checkout Session API
 * Handles creation of Stripe checkout sessions for subscription payments
 *
 * @description Secure API endpoint for initiating subscription payments
 * @author Evolution Combatives
 */

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe';
import { SUBSCRIPTION_PRICING } from '@/src/lib/shared/constants/subscriptionTiers';
import { createAdminClient } from '@/src/lib/supabase';
import { json } from '@/src/lib/http';
import { z } from 'zod';

// Request validation schema
const CreateCheckoutSchema = z.object({
    tier: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    userId: z.string().uuid(),
    userEmail: z.string().email(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
});

export async function POST({ request }: { request: Request }) {
    let tier, userId, userEmail;
    try {
        const body = await request.json();
        const validatedData = CreateCheckoutSchema.parse(body);

        ({ tier, userId, userEmail } = validatedData);
        const { successUrl, cancelUrl } = validatedData;

        // Verify user exists and is authenticated
        const supabase = createAdminClient();
        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return json(
                { error: 'User not found or not authenticated' },
                { status: 401 }
            );
        }

        // Verify email matches
        if (user.email !== userEmail) {
            return json(
                { error: 'Email mismatch' },
                { status: 400 }
            );
        }

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

        // Log the checkout session creation
        console.log('✅ Checkout session created successfully:', {
            userId,
            tier,
            sessionId: session.id,
            url: session.url,
            customerEmail: session.customer_details?.email || userEmail,
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
            requestBody: { tier, userId, userEmail },
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
