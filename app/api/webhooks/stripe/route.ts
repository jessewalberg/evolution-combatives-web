/**
 * Evolution Combatives - Stripe Webhook Handler
 * Processes Stripe webhook events for subscription management
 * 
 * @description Secure webhook endpoint for handling Stripe subscription events
 * @author Evolution Combatives
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature } from '@/src/lib/stripe';
import { createAdminClient } from '@/src/lib/supabase';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            console.error('Missing Stripe signature header');
            return NextResponse.json(
                { error: 'Missing signature' },
                { status: 400 }
            );
        }

        // Validate webhook signature
        const event = validateWebhookSignature(body, signature, webhookSecret!);

        console.log(`Received Stripe webhook: ${event.type}, ID: ${event.id}`);

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 400 }
        );
    }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const { userId, tier } = session.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata in checkout session:', session.id);
        return;
    }

    console.log(`Checkout completed for user ${userId}, tier ${tier}, session ${session.id}`);

    // The actual subscription creation will be handled by the subscription.created webhook
    // This is just for logging and any immediate actions needed
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const { userId, tier } = subscription.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata in subscription:', subscription.id);
        return;
    }

    const supabase = createAdminClient();

    // Create subscription record in database
    const { error } = await supabase
        .from('subscriptions')
        .insert({
            user_id: userId,
            tier: tier as 'beginner' | 'intermediate' | 'advanced',
            status: subscription.status as any,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        });

    if (error) {
        console.error('Error creating subscription in database:', error);
        throw error;
    }

    // Update user profile with subscription tier
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', userId);

    if (profileError) {
        console.error('Error updating user profile:', profileError);
    }

    console.log(`Subscription created in database for user ${userId}, tier ${tier}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const supabase = createAdminClient();

    // Update subscription record
    const { error } = await supabase
        .from('subscriptions')
        .update({
            status: subscription.status as any,
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        })
        .eq('stripe_subscription_id', subscription.id);

    if (error) {
        console.error('Error updating subscription in database:', error);
        throw error;
    }

    // If subscription was cancelled, update user profile
    if (subscription.status === 'canceled') {
        const { data: subscriptionData } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

        if (subscriptionData) {
            await supabase
                .from('profiles')
                .update({ subscription_tier: null })
                .eq('id', subscriptionData.user_id);
        }
    }

    console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const supabase = createAdminClient();

    // Update subscription status to canceled
    const { error } = await supabase
        .from('subscriptions')
        .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

    if (error) {
        console.error('Error updating canceled subscription:', error);
        throw error;
    }

    // Remove subscription tier from user profile
    const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

    if (subscriptionData) {
        await supabase
            .from('profiles')
            .update({ subscription_tier: null })
            .eq('id', subscriptionData.user_id);
    }

    console.log(`Subscription canceled: ${subscription.id}`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    if ((invoice as any).subscription) {
        const supabase = createAdminClient();

        // Update subscription status to active (in case it was past_due)
        await supabase
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', (invoice as any).subscription as string);

        console.log(`Payment succeeded for subscription: ${(invoice as any).subscription}`);
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    if ((invoice as any).subscription) {
        const supabase = createAdminClient();

        // Update subscription status to past_due
        await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', (invoice as any).subscription as string);

        console.log(`Payment failed for subscription: ${(invoice as any).subscription}`);
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    });
}
