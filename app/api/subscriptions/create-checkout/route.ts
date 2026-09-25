/**
 * Browser checkout endpoint. Identity is derived exclusively from the verified
 * Supabase cookie session; request bodies cannot select another user/customer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'
import { SUBSCRIPTION_PRICING } from '@/src/lib/shared/constants/subscriptionTiers'
import { createServerClient } from '@/src/lib/supabase'

const CreateCheckoutSchema = z
    .object({
        tier: z.enum(['tier1', 'tier2', 'tier3']),
    })
    .strict()

export async function POST(request: NextRequest) {
    try {
        const validated = CreateCheckoutSchema.parse(await request.json())
        const supabase = await createServerClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user?.id || !user.email) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }

        const { data: existingSubscription, error: subscriptionError } =
            await supabase
                .from('subscriptions')
                .select('id, status, tier')
                .eq('user_id', user.id)
                .in('status', ['active', 'trialing'])
                .limit(1)
                .maybeSingle()

        if (subscriptionError) {
            throw new Error('Unable to verify subscription state')
        }

        if (existingSubscription) {
            return NextResponse.json(
                {
                    error: 'User already has an active subscription',
                    currentTier: existingSubscription.tier,
                },
                { status: 409 }
            )
        }

        const pricing = SUBSCRIPTION_PRICING[validated.tier]
        if (!pricing?.stripePriceId) {
            return NextResponse.json(
                { error: `Price ID not configured for tier: ${validated.tier}` },
                { status: 503 }
            )
        }

        const customer = await getOrCreateCustomer(user.email, user.id)
        const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
        const origin =
            configuredOrigin ||
            (process.env.NODE_ENV === 'production'
                ? 'https://www.evolutioncombatives.com'
                : request.nextUrl.origin)

        const session = await createCheckoutSession({
            priceId: pricing.stripePriceId,
            customerId: customer.id,
            userId: user.id,
            tier: validated.tier,
            successUrl: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}&tier=${validated.tier}`,
            cancelUrl: `${origin}/subscription-cancel`,
        })

        return NextResponse.json({
            sessionId: session.id,
            url: session.url,
            tier: validated.tier,
            price: pricing.monthly,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error.errors },
                { status: 400 }
            )
        }

        console.error('Checkout creation failed', {
            message: error instanceof Error ? error.message : 'Unknown error',
        })
        return NextResponse.json(
            { error: 'Unable to create checkout session' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'checkout-session-creation',
    })
}
