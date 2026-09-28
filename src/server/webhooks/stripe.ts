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

// Stripe's 2025-03-31 "basil" API version moved current_period_start/end
// off the Subscription object onto its first subscription item, and
// deprecated Invoice.subscription in favor of parent.subscription_details.
// The types below keep the legacy top-level shapes as an optional fallback
// (older API versions, or Stripe's SDK test fixtures, may still provide
// them) while the primary read path uses the current shape.
interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
    current_period_start?: number;
    current_period_end?: number;
}

interface StripeInvoiceWithSubscription extends Stripe.Invoice {
    subscription?: string | Stripe.Subscription | null;
}

function getSubscriptionPeriod(subscription: StripeSubscriptionWithPeriod): { start?: number; end?: number } {
    const item = subscription.items?.data?.[0];
    return {
        start: item?.current_period_start ?? subscription.current_period_start,
        end: item?.current_period_end ?? subscription.current_period_end,
    };
}

function getInvoiceSubscriptionId(invoice: StripeInvoiceWithSubscription): string | undefined {
    const parentSubscription = invoice.parent?.subscription_details?.subscription;
    if (parentSubscription) {
        return typeof parentSubscription === 'string' ? parentSubscription : parentSubscription.id;
    }
    if (invoice.subscription) {
        return typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
    }
    return undefined;
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
};

function toRpcPayload(subscription: StripeSubscriptionWithPeriod): SubscriptionRpcPayload {
    const { userId, tier } = subscription.metadata || {};
    const { start, end } = getSubscriptionPeriod(subscription);
    return {
        user_id: userId,
        tier,
        external_subscription_id: subscription.id,
        status: subscription.status,
        stripe_subscription_id: subscription.id,
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
async function applyCurrentSubscriptionState(subscriptionId: string, eventId: string) {
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as StripeSubscriptionWithPeriod;
    const { userId, tier } = subscription.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata on Stripe subscription:', subscriptionId);
        return;
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc('apply_stripe_subscription_event', {
        p_subscription: toRpcPayload(subscription),
        p_event_id: eventId,
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
                await applyCurrentSubscriptionState(subscription.id, event.id);
                break;
            }

            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object as StripeInvoiceWithSubscription;
                const subscriptionId = getInvoiceSubscriptionId(invoice);
                if (subscriptionId) {
                    await applyCurrentSubscriptionState(subscriptionId, event.id);
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
    const { userId, tier } = session.metadata || {};

    if (!userId || !tier) {
        console.error('Missing metadata in checkout session:', session.id);
        return;
    }

    console.log(`Checkout completed for user ${userId}, tier ${tier}, session ${session.id}`);

    // The actual subscription creation will be handled by the subscription.created webhook
    // This is just for logging and any immediate actions needed
}

// Health check endpoint
export async function GET() {
    return json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    });
}
