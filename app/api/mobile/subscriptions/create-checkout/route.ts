import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
    createCheckoutSession,
    getOrCreateCustomer,
    stripe,
} from '../../../../../src/lib/stripe'
import { authenticateMobileBearer } from '../../../../../src/lib/mobile-auth'
import {
    isAllowedMobileRedirect,
    mobileDeepLink,
} from '../../../../../src/lib/mobile-redirects'
import {
    SUBSCRIPTION_PRICING,
    SUBSCRIPTION_TIER_HIERARCHY,
    type SubscriptionTier,
} from '../../../../../src/lib/shared/constants/subscriptionTiers'

const PaidTierSchema = z.enum(['tier1', 'tier2', 'tier3'])

const CreateCheckoutSchema = z
    .object({
        tier: PaidTierSchema,
        successUrl: z
            .string()
            .refine(isAllowedMobileRedirect, 'Untrusted success URL')
            .optional(),
        cancelUrl: z
            .string()
            .refine(isAllowedMobileRedirect, 'Untrusted cancel URL')
            .optional(),
    })
    .strict()

const errorResponse = (status: number, error: string) =>
    NextResponse.json({ success: false, error }, { status })

/**
 * Create a first-time Stripe checkout or an authenticated update-confirm flow.
 * Existing subscription/customer IDs are always loaded from the caller's own
 * RLS-protected records; client-provided ownership claims are rejected.
 */
export async function POST(request: NextRequest) {
    const authResult = await authenticateMobileBearer(request)
    if ('error' in authResult) return authResult.error

    let requestData: z.infer<typeof CreateCheckoutSchema>
    try {
        requestData = CreateCheckoutSchema.parse(await request.json())
    } catch (error) {
        if (error instanceof z.ZodError) {
            return errorResponse(400, 'Invalid request data')
        }
        return errorResponse(400, 'Invalid JSON body')
    }

    const { user, supabase } = authResult.data
    if (!user.email) {
        return errorResponse(400, 'Authenticated account has no email address')
    }

    const { tier } = requestData
    const successUrl =
        requestData.successUrl ||
        mobileDeepLink(`subscription/success?tier=${tier}`)
    const cancelUrl =
        requestData.cancelUrl || mobileDeepLink('subscription/cancel')
    const pricing = SUBSCRIPTION_PRICING[tier]

    if (!pricing.stripePriceId) {
        return errorResponse(503, 'Subscription price is not configured')
    }

    const { data: currentSubscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select(
            'tier, status, platform, stripe_subscription_id, stripe_customer_id, external_subscription_id, created_at'
        )
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (subscriptionError) {
        return errorResponse(500, 'Unable to verify current subscription')
    }

    try {
        if (currentSubscription) {
            if (
                typeof currentSubscription.tier !== 'string' ||
                !(currentSubscription.tier in SUBSCRIPTION_TIER_HIERARCHY)
            ) {
                return errorResponse(500, 'Current subscription tier is invalid')
            }
            const currentTier = currentSubscription.tier as SubscriptionTier

            if (
                SUBSCRIPTION_TIER_HIERARCHY[tier] <=
                SUBSCRIPTION_TIER_HIERARCHY[currentTier]
            ) {
                return errorResponse(
                    409,
                    'Requested tier must be higher than the current subscription tier'
                )
            }

            if (
                currentSubscription.platform !== 'stripe' ||
                !currentSubscription.stripe_customer_id
            ) {
                return errorResponse(
                    409,
                    'This subscription must be managed through its original platform'
                )
            }

            const stripeSubscriptionId =
                currentSubscription.stripe_subscription_id ||
                currentSubscription.external_subscription_id

            if (!stripeSubscriptionId) {
                return errorResponse(409, 'Subscription billing record is incomplete')
            }

            const stripeSubscription = await stripe.subscriptions.retrieve(
                stripeSubscriptionId
            )
            const stripeCustomerId =
                typeof stripeSubscription.customer === 'string'
                    ? stripeSubscription.customer
                    : stripeSubscription.customer.id

            if (
                stripeCustomerId !== currentSubscription.stripe_customer_id ||
                !['active', 'trialing'].includes(stripeSubscription.status)
            ) {
                return errorResponse(409, 'Subscription billing state has changed')
            }

            const item = stripeSubscription.items.data[0]
            if (!item) {
                return errorResponse(409, 'Subscription has no updatable item')
            }

            const session = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: cancelUrl,
                flow_data: {
                    type: 'subscription_update_confirm',
                    after_completion: {
                        type: 'redirect',
                        redirect: { return_url: successUrl },
                    },
                    subscription_update_confirm: {
                        subscription: stripeSubscription.id,
                        items: [
                            {
                                id: item.id,
                                price: pricing.stripePriceId,
                                quantity: item.quantity || 1,
                            },
                        ],
                    },
                },
            })

            return NextResponse.json({
                success: true,
                data: {
                    sessionId: session.id,
                    url: session.url,
                    tier,
                    price: pricing.monthly,
                    currency: pricing.currency.toLowerCase(),
                    expiresAt: null,
                    mode: 'subscription_update',
                },
            })
        }

        const customer = await getOrCreateCustomer(user.email, user.id)
        const session = await createCheckoutSession({
            customerId: customer.id,
            priceId: pricing.stripePriceId,
            userId: user.id,
            tier,
            successUrl,
            cancelUrl,
        })

        if (!session.url) {
            return errorResponse(502, 'Payment provider did not return a checkout URL')
        }

        return NextResponse.json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url,
                tier,
                price: (session.amount_total || 0) / 100,
                currency: session.currency || pricing.currency.toLowerCase(),
                expiresAt: new Date(session.expires_at * 1000).toISOString(),
                mode: 'checkout',
            },
        })
    } catch {
        return errorResponse(502, 'Payment processing is temporarily unavailable')
    }
}
