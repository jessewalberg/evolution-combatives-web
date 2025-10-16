import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '../../../../src/lib/stripe'
import { createAdminClient } from '../../../../src/lib/supabase'
import Stripe from 'stripe'

/**
 * Debug endpoint to manually sync subscription from Stripe
 * Use this to fix subscription state when webhooks don't work in development
 */
export async function POST(request: NextRequest) {
    try {
        const { email, stripeSubscriptionId } = await request.json()

        if (!email && !stripeSubscriptionId) {
            return NextResponse.json(
                { error: 'Email or Stripe subscription ID required' },
                { status: 400 }
            )
        }

        let subscription: Stripe.Subscription | null = null

        // Find subscription by email or ID
        if (stripeSubscriptionId) {
            subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
        } else if (email) {
            // Find customer by email
            const customers = await stripe.customers.list({ email, limit: 1 })
            if (customers.data.length === 0) {
                return NextResponse.json(
                    { error: 'No customer found with that email' },
                    { status: 404 }
                )
            }

            const customer = customers.data[0]
            const subscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'active',
                limit: 1
            })

            if (subscriptions.data.length === 0) {
                return NextResponse.json(
                    { error: 'No active subscription found for customer' },
                    { status: 404 }
                )
            }

            subscription = subscriptions.data[0]
        }

        if (!subscription) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            )
        }

        // Get customer details
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer
        const customerEmail = customer.email

        // Extract tier from subscription metadata or price
        let tier = 'tier1' // Default
        if (subscription.metadata?.tier) {
            tier = subscription.metadata.tier
        } else {
            // Try to determine tier from price ID
            const priceId = subscription.items.data[0]?.price.id
            // You may need to update this mapping based on your actual Stripe price IDs
            if (priceId?.includes('beginner') || priceId?.includes('tier1')) tier = 'tier1'
            else if (priceId?.includes('intermediate') || priceId?.includes('tier2')) tier = 'tier2'
            else if (priceId?.includes('advanced') || priceId?.includes('tier3')) tier = 'tier3'
        }

        // Find user in database
        const supabase = createAdminClient()
        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', customerEmail)
            .single()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            )
        }

        // Check if subscription already exists
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('stripe_subscription_id', subscription.id)
            .single()

        // Extract period dates - Stripe API v18+ uses Date objects
        const currentPeriodStart = 'current_period_start' in subscription
            ? new Date((subscription.current_period_start as number) * 1000).toISOString()
            : new Date().toISOString()
        const currentPeriodEnd = 'current_period_end' in subscription
            ? new Date((subscription.current_period_end as number) * 1000).toISOString()
            : new Date().toISOString()

        if (existingSub) {
            // Update existing subscription
            const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                    tier: tier as 'tier1' | 'tier2' | 'tier3',
                    status: subscription.status as 'active' | 'canceled',
                    current_period_start: currentPeriodStart,
                    current_period_end: currentPeriodEnd,
                    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSub.id)

            if (updateError) {
                throw updateError
            }
        } else {
            // Create new subscription
            const { error: insertError } = await supabase
                .from('subscriptions')
                .insert({
                    user_id: user.id,
                    tier: tier as 'tier1' | 'tier2' | 'tier3',
                    status: subscription.status as 'active' | 'canceled',
                    stripe_subscription_id: subscription.id,
                    stripe_customer_id: subscription.customer as string,
                    current_period_start: currentPeriodStart,
                    current_period_end: currentPeriodEnd,
                    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
                    canceled_at: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })

            if (insertError) {
                throw insertError
            }
        }

        // Update user's subscription tier in profiles table
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                subscription_tier: tier,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

        if (profileError) {
            throw profileError
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription synced successfully',
            data: {
                userId: user.id,
                email: customerEmail,
                tier,
                status: subscription.status,
                stripeSubscriptionId: subscription.id
            }
        })

    } catch (error) {
        console.error('Error syncing subscription:', error)
        return NextResponse.json(
            {
                error: 'Failed to sync subscription',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}