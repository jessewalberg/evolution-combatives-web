import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, getOrCreateCustomer } from '../../../../../src/lib/stripe'
import { SUBSCRIPTION_PRICING } from '../../../../../src/lib/shared/constants/subscriptionTiers'
import { z } from 'zod'

// Use exact subscription tiers from .cursorrules
type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3'

// Request validation schema
const CreateCheckoutSchema = z.object({
    tier: z.enum(['none', 'tier1', 'tier2', 'tier3']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    upgradeFromTier: z.enum(['none', 'tier1', 'tier2', 'tier3']).optional(),
    stripeSubscriptionId: z.string().optional(),
})

async function validateMobileAppAuth(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        const mobileClient = request.headers.get('X-Mobile-Client')
        const userAgent = request.headers.get('User-Agent')

        console.log('🔐 [Mobile Subscription API] Auth Debug:', {
            hasAuthHeader: !!authHeader,
            authHeaderStart: authHeader?.substring(0, 20) + '...',
            headerLength: authHeader?.length,
            mobileClient,
            userAgent
        });

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                error: NextResponse.json(
                    { success: false, error: 'Bearer token required for mobile API' },
                    { status: 401 }
                )
            }
        }

        // Verify this is actually a mobile client request
        if (!mobileClient || !userAgent?.includes('EvolutionCombatives-Mobile')) {
            console.warn('🚨 [Mobile Subscription API] Non-mobile client accessing mobile endpoint:', {
                mobileClient,
                userAgent
            });
            // Allow it but log the warning
        }

        const token = authHeader.replace('Bearer ', '')

        // Create Supabase client with the provided JWT token
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        )

        // Verify the user with the token
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        console.log('🔐 [Mobile Subscription API] User Validation Result:', {
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
            hasError: !!userError,
            errorMessage: userError?.message
        });

        if (userError || !user) {
            console.error('❌ [Mobile Subscription API] User validation failed:', userError);
            return {
                error: NextResponse.json(
                    { success: false, error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }
        }

        // Get user profile for additional security verification
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, subscription_tier')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            console.error('❌ [Mobile Subscription API] Profile validation failed:', profileError);
            return {
                error: NextResponse.json(
                    { success: false, error: 'User profile not found' },
                    { status: 401 }
                )
            }
        }

        console.log('✅ [Mobile Subscription API] User authenticated successfully:', user.email);
        return { user, profile, supabase }
    } catch (error) {
        console.error('[Mobile Subscription API] Auth validation error:', error)
        return {
            error: NextResponse.json(
                { success: false, error: 'Authentication failed' },
                { status: 500 }
            )
        }
    }
}

/**
 * Mobile-specific subscription checkout API endpoint
 * This endpoint bypasses CSRF protection since mobile apps use Bearer token auth
 * and are not subject to CSRF attacks like web browsers
 */
export async function POST(request: NextRequest) {
    console.log('📱 [Mobile Subscription API] Incoming subscription checkout request');

    const authResult = await validateMobileAppAuth(request)
    if ('error' in authResult) {
        return authResult.error
    }

    const { user, profile } = authResult

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
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Invalid upgrade: Cannot downgrade or switch to same tier',
                        details: `Cannot upgrade from ${upgradeFromTier} to ${tier}`
                    },
                    { status: 400 }
                )
            }
        }

        // Get or create Stripe customer
        const customer = await getOrCreateCustomer(user.email!, user.id)

        console.log('👤 [Mobile Subscription API] Stripe customer:', {
            customerId: customer.id,
            userEmail: user.email
        });

        // Get pricing for the tier
        const pricing = SUBSCRIPTION_PRICING[tier as SubscriptionTier]
        if (!pricing) {
            return NextResponse.json(
                { success: false, error: 'Invalid subscription tier' },
                { status: 400 }
            )
        }

        // Create Stripe checkout session
        const session = await createCheckoutSession({
            customerId: customer.id,
            priceId: pricing.stripePriceId,
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

        return NextResponse.json(response)

    } catch (error) {
        console.error('[Mobile Subscription API] Error creating checkout session:', error)

        // Handle validation errors
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid request data',
                    details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
                },
                { status: 400 }
            )
        }

        // Handle Stripe errors
        if (error instanceof Error && error.message.includes('stripe')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Payment processing error',
                    details: 'Unable to create checkout session. Please try again.'
                },
                { status: 500 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create checkout session',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}