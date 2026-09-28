/**
 * Evolution Combatives - Create Stripe Checkout Session API
 * Handles creation of Stripe checkout sessions for subscription payments
 *
 * @description Secure API endpoint for initiating subscription payments
 * @author Evolution Combatives
 */

import { SUBSCRIPTION_PRICING } from '@/src/lib/shared/constants/subscriptionTiers';
import { getStripePriceId } from './price-id';
import { createServerClient, createAdminClient } from '@/src/lib/supabase';
import { requireAuthenticatedSession } from '@/src/lib/session-auth';
import { assertSingleNonTerminalSubscription, createReservedCheckoutSession } from './checkout-flow';
import { json } from '@/src/lib/http';
import { z } from 'zod';

const CreateCheckoutSchema = z.object({
    tier: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
});

export async function POST({ request }: { request: Request }) {
    let tier: string | undefined;
    let userId: string | undefined;
    let userEmail: string | undefined;
    try {
        const auth = await requireAuthenticatedSession();
        if ('error' in auth) {
            return auth.error;
        }

        userId = auth.userId;
        userEmail = auth.email;

        const body = await request.json();
        const validatedData = CreateCheckoutSchema.parse(body);
        tier = validatedData.tier;
        const { successUrl, cancelUrl } = validatedData;

        const supabase = await createServerClient();
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

        if (user.email?.toLowerCase() !== userEmail) {
            return json(
                { error: 'Email mismatch' },
                { status: 400 }
            );
        }

        const subscriptionGuard = await assertSingleNonTerminalSubscription(supabase, userId);
        if (!subscriptionGuard.ok) {
            return json(
                {
                    error: subscriptionGuard.error,
                    ...(subscriptionGuard.currentStatus
                        ? {
                              currentTier: subscriptionGuard.currentTier,
                              currentStatus: subscriptionGuard.currentStatus,
                          }
                        : {}),
                },
                { status: subscriptionGuard.status },
            );
        }

        const priceId = getStripePriceId(tier as 'none' | 'tier1' | 'tier2' | 'tier3');
        if (!priceId) {
            return json(
                { error: `Price ID not configured for tier: ${tier}` },
                { status: 500 }
            );
        }

        const defaultSuccessUrl = successUrl || `${(process.env.MOBILE_APP_SCHEME || 'evolutioncombatives')}://subscription/success?tier=${tier}`;
        const defaultCancelUrl = cancelUrl || `${(process.env.MOBILE_APP_SCHEME || 'evolutioncombatives')}://subscription/cancel`;

        const admin = createAdminClient();
        const checkout = await createReservedCheckoutSession({
            admin,
            userId,
            userEmail,
            tier,
            priceId,
            successUrl: defaultSuccessUrl,
            cancelUrl: defaultCancelUrl,
        });

        if (!checkout.ok) {
            return json(
                {
                    error: checkout.error,
                    ...(checkout.currentStatus
                        ? { currentTier: checkout.currentTier, currentStatus: checkout.currentStatus }
                        : {}),
                },
                { status: checkout.status },
            );
        }

        console.log('✅ Checkout session created successfully:', {
            userId,
            tier,
            sessionId: checkout.sessionId,
            url: checkout.url,
            reused: checkout.reused,
            customerEmail: userEmail,
            timestamp: new Date().toISOString()
        });

        return json({
            sessionId: checkout.sessionId,
            url: checkout.url,
            tier,
            price: SUBSCRIPTION_PRICING[tier as keyof typeof SUBSCRIPTION_PRICING].monthly,
        });

    } catch (error) {
        console.error('❌ Error creating checkout session:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            requestBody: { tier, userId, userEmail },
            timestamp: new Date().toISOString()
        });

        if (error instanceof z.ZodError) {
            return json(
                {
                    error: 'Invalid request data',
                    details: error.issues
                },
                { status: 400 }
            );
        }

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

export async function GET() {
    return json({
        status: 'ok',
        service: 'checkout-session-creation',
        timestamp: new Date().toISOString(),
    });
}
