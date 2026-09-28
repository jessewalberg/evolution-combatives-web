/**
 * Evolution Combatives - Stripe Webhook Handler
 * Processes Stripe webhook events for subscription management
 * 
 * @description Secure webhook endpoint for handling Stripe subscription events
 * @author Evolution Combatives
 */

import { validateWebhookSignature } from '@/src/lib/stripe';
import { createAdminClient } from '@/src/lib/supabase';
import { json } from '@/src/lib/http';
import Stripe from 'stripe';

// Extended interface for Stripe Subscription with period properties
interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
    current_period_start: number;
    current_period_end: number;
}

// Extended interface for Stripe Invoice with subscription property
interface StripeInvoiceWithSubscription extends Stripe.Invoice {
    subscription: string | Stripe.Subscription | null;
}

type SubscriptionRpcPayload = {
    user_id?: string;
    tier?: string;
    external_subscription_id: string;
    status: string;
    stripe_subscription_id: string;
    stripe_customer_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    canceled_at?: string | null;
    updated_at: string;
};

/**
 * Apply one Stripe subscription event through the single ordering-guarded
 * state RPC (public.apply_stripe_subscription_event). event_created_at/
 * event_id come from the Stripe Event envelope, not the Subscription/Invoice
 * object, and are what let the function reject stale/out-of-order deliveries
 * - see the migration for the full invariant.
 */
async function applySubscriptionEvent(
    payload: SubscriptionRpcPayload,
    event: Pick<Stripe.Event, 'created' | 'id'>
) {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc('apply_stripe_subscription_event', {
        p_subscription: payload,
        p_event_created_at: new Date(event.created * 1000).toISOString(),
        p_event_id: event.id,
    });

    if (error) {
        console.error('Error applying Stripe subscription event:', error);
        throw error;
    }
}

function subscriptionToRpcPayload(subscription: StripeSubscriptionWithPeriod): SubscriptionRpcPayload {
    const { userId, tier } = subscription.metadata || {};
    return {
        user_id: userId,
        tier,
        external_subscription_id: subscription.id,
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
        updated_at: new Date().toISOString(),
    };
}

export async function POST({ request }: { request: Request }) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET environment variable is required');
        return json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        console.error('Missing Stripe signature header');
        return json(
            { error: 'Missing signature' },
            { status: 400 }
        );
    }

    let event: Stripe.Event;
    try {
        event = await validateWebhookSignature(body, signature, webhookSecret);
    } catch (error) {
        console.error('Webhook signature error:', error);
        return json(
            { error: 'Webhook handler failed' },
            { status: 400 }
        );
    }

    try {
        console.log(`Received Stripe webhook: ${event.type}, ID: ${event.id}`);

        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object as StripeSubscriptionWithPeriod, event);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as StripeSubscriptionWithPeriod, event);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as StripeInvoiceWithSubscription, event);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object as StripeInvoiceWithSubscription, event);
                break;

            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }

        return json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        return json(
            { error: 'Webhook handler failed' },
            { status: 500 }
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
async function handleSubscriptionCreated(subscription: StripeSubscriptionWithPeriod, event: Stripe.Event) {
    const { userId, tier } = subscription.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata in subscription:', subscription.id);
        return;
    }

    await applySubscriptionEvent(subscriptionToRpcPayload(subscription), event);

    console.log(`Subscription creation recorded for user ${userId}, tier ${tier}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: StripeSubscriptionWithPeriod, event: Stripe.Event) {
    await applySubscriptionEvent(subscriptionToRpcPayload(subscription), event);

    console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, event: Stripe.Event) {
    const withPeriod = subscription as StripeSubscriptionWithPeriod;
    const { userId, tier } = subscription.metadata || {};
    const now = new Date().toISOString();

    await applySubscriptionEvent(
        {
            user_id: userId,
            tier,
            external_subscription_id: subscription.id,
            status: 'canceled',
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            current_period_start: withPeriod.current_period_start
                ? new Date(withPeriod.current_period_start * 1000).toISOString()
                : undefined,
            current_period_end: withPeriod.current_period_end
                ? new Date(withPeriod.current_period_end * 1000).toISOString()
                : undefined,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: now,
            updated_at: now,
        },
        event
    );

    console.log(`Subscription canceled: ${subscription.id}`);
}

/**
 * Handle successful payment. Routed through the same ordering-guarded RPC
 * as subscription events (no user_id - invoices don't carry subscription
 * metadata - so it can only touch an existing row for this Stripe
 * subscription id, and never sets tier).
 */
async function handlePaymentSucceeded(invoice: StripeInvoiceWithSubscription, event: Stripe.Event) {
    if (!invoice.subscription) return;

    const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;

    await applySubscriptionEvent(
        {
            external_subscription_id: subscriptionId,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            updated_at: new Date().toISOString(),
        },
        event
    );

    console.log(`Payment succeeded for subscription: ${subscriptionId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: StripeInvoiceWithSubscription, event: Stripe.Event) {
    if (!invoice.subscription) return;

    const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;

    await applySubscriptionEvent(
        {
            external_subscription_id: subscriptionId,
            stripe_subscription_id: subscriptionId,
            status: 'past_due',
            updated_at: new Date().toISOString(),
        },
        event
    );

    console.log(`Payment failed for subscription: ${subscriptionId}`);
}

// Health check endpoint
export async function GET() {
    return json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    });
}
