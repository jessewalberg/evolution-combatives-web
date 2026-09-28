/**
 * Evolution Combatives - Stripe Webhook Handler
 * Processes Stripe webhook events for subscription management
 *
 * @description Secure webhook endpoint for handling Stripe subscription events
 * @author Evolution Combatives
 */

import { validateWebhookSignature, stripe } from '@/src/lib/stripe';
import { createAdminClient } from '@/src/lib/supabase';
import { json } from '@/src/lib/http';
import Stripe from 'stripe';

function getSubscriptionPeriod(subscription: Stripe.Subscription): { start?: number; end?: number } {
    const item = subscription.items?.data?.[0];
    return {
        start: item?.current_period_start,
        end: item?.current_period_end,
    };
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    const parentSubscription = invoice.parent?.subscription_details?.subscription;
    if (parentSubscription) {
        return typeof parentSubscription === 'string' ? parentSubscription : parentSubscription.id;
    }
    return undefined;
}

type SubscriptionRpcPayload = {
    user_id?: string;
    tier?: string;
    external_subscription_id: string;
    status: string;
    stripe_subscription_id: string;
    stripe_created_at: string;
    stripe_customer_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    canceled_at?: string | null;
};

function toRpcPayload(subscription: Stripe.Subscription): SubscriptionRpcPayload {
    const { userId, tier } = subscription.metadata || {};
    const { start, end } = getSubscriptionPeriod(subscription);
    return {
        user_id: userId,
        tier,
        external_subscription_id: subscription.id,
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_created_at: new Date(subscription.created * 1000).toISOString(),
        stripe_customer_id: subscription.customer as string,
        current_period_start: start ? new Date(start * 1000).toISOString() : undefined,
        current_period_end: end ? new Date(end * 1000).toISOString() : undefined,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
    };
}

/**
 * Apply a Stripe subscription's *current* state (never the possibly-stale
 * event payload - see the migration's header comment for why) through the
 * single state RPC.
 */
async function applyCurrentSubscriptionState(
    subscriptionId: string,
    eventId: string,
    eventCreatedAt: number,
    paymentSucceeded: boolean,
) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const { userId, tier } = subscription.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata on Stripe subscription:', subscriptionId);
        return;
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc('apply_stripe_subscription_event', {
        p_subscription: toRpcPayload(subscription),
        p_event_id: eventId,
        p_event_created_at: eventCreatedAt,
        p_payment_succeeded: paymentSucceeded,
    });

    if (error) {
        console.error('Error applying Stripe subscription state:', error);
        throw error;
    }
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
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await applyCurrentSubscriptionState(subscription.id, event.id, event.created, false);
                break;
            }

            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = getInvoiceSubscriptionId(invoice);
                if (subscriptionId) {
                    await applyCurrentSubscriptionState(subscriptionId, event.id, event.created, event.type === 'invoice.payment_succeeded');
                }
                break;
            }

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
    const { userId } = session.metadata || {};
    const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!userId || !subscriptionId) {
        console.error('Missing metadata in checkout session:', session.id);
        throw new Error('Checkout session is missing reservation metadata');
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('consume_stripe_checkout', {
        p_user_id: userId,
        p_checkout_session_id: session.id,
        p_stripe_subscription_id: subscriptionId,
    });
    if (error) {
        throw error;
    }
    if (!data) {
        throw new Error('Checkout session reservation is not ready');
    }
}

// Health check endpoint
export async function GET() {
    return json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    });
}
