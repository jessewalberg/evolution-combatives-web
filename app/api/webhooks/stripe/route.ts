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

type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3';
type SubscriptionIdentity = { userId: string; tier: SubscriptionTier };
type AdminClient = ReturnType<typeof createAdminClient>;

const subscriptionTiers = new Set<SubscriptionTier>([
    'none',
    'tier1',
    'tier2',
    'tier3',
]);
const accessGrantingStatuses = new Set<Stripe.Subscription.Status>([
    'active',
    'trialing',
]);
const accessRevokingStatuses = new Set<Stripe.Subscription.Status>([
    'canceled',
    'incomplete_expired',
    'paused',
    'unpaid',
]);
const irreversibleStatuses = new Set<Stripe.Subscription.Status>([
    'canceled',
    'incomplete_expired',
]);

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
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.paused':
            case 'customer.subscription.resumed':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.paid':
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
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

function getExpandableId(value: string | { id: string } | null | undefined) {
    return typeof value === 'string' ? value : value?.id || null;
}

function getSubscriptionIdentity(
    subscription: Stripe.Subscription
): SubscriptionIdentity | null {
    const { userId, tier } = subscription.metadata;

    if (
        typeof userId !== 'string' ||
        typeof tier !== 'string' ||
        !subscriptionTiers.has(tier as SubscriptionTier)
    ) {
        return null;
    }

    return { userId, tier: tier as SubscriptionTier };
}

/**
 * Basil moved billing periods from the subscription to each subscription item.
 * Evolution subscriptions contain one tier item, so that item is the canonical
 * access period persisted in the existing single-period database columns.
 */
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];

    if (
        !item ||
        !Number.isFinite(item.current_period_start) ||
        !Number.isFinite(item.current_period_end) ||
        item.current_period_end < item.current_period_start
    ) {
        throw new Error(`Subscription ${subscription.id} has no valid billing period`);
    }

    return {
        current_period_start: new Date(
            item.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(item.current_period_end * 1000).toISOString(),
    };
}

function getCanceledAt(
    subscription: Stripe.Subscription,
    status: Stripe.Subscription.Status
) {
    const timestamp =
        status === 'canceled'
            ? subscription.ended_at || subscription.canceled_at
            : subscription.canceled_at;

    return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getSubscriptionState(
    subscription: Stripe.Subscription,
    status: Stripe.Subscription.Status = subscription.status
) {
    return {
        status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: getExpandableId(subscription.customer),
        ...getSubscriptionPeriod(subscription),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: getCanceledAt(subscription, status),
        updated_at: new Date().toISOString(),
    };
}

async function getStoredSubscription(
    supabase: AdminClient,
    subscriptionId: string
) {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id, tier, status')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

async function updateProfileTier(
    supabase: AdminClient,
    userId: string,
    tier: SubscriptionTier | null
) {
    const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: tier })
        .eq('id', userId);

    if (error) {
        throw error;
    }
}

async function syncProfileAccess(
    supabase: AdminClient,
    subscriptionId: string,
    status: Stripe.Subscription.Status,
    identity?: SubscriptionIdentity | null
) {
    if (
        !accessGrantingStatuses.has(status) &&
        !accessRevokingStatuses.has(status)
    ) {
        return;
    }

    const stored = identity
        ? null
        : await getStoredSubscription(supabase, subscriptionId);
    const userId = identity?.userId || stored?.user_id;

    if (!userId) {
        return;
    }

    const tier = accessGrantingStatuses.has(status)
        ? identity?.tier || (stored?.tier as SubscriptionTier | undefined)
        : null;

    if (accessGrantingStatuses.has(status) && !tier) {
        return;
    }

    await updateProfileTier(supabase, userId, tier || null);
}

async function isTerminalRegression(
    supabase: AdminClient,
    subscription: Stripe.Subscription,
    nextStatus: Stripe.Subscription.Status
) {
    if (irreversibleStatuses.has(nextStatus)) {
        return false;
    }

    const stored = await getStoredSubscription(supabase, subscription.id);
    return Boolean(
        stored &&
            irreversibleStatuses.has(stored.status as Stripe.Subscription.Status)
    );
}

async function upsertSubscription(
    supabase: AdminClient,
    subscription: Stripe.Subscription,
    identity: SubscriptionIdentity,
    status: Stripe.Subscription.Status = subscription.status
) {
    const { error } = await supabase.from('subscriptions').upsert(
        {
            user_id: identity.userId,
            platform: 'stripe',
            external_subscription_id: subscription.id,
            tier: identity.tier,
            ...getSubscriptionState(subscription, status),
        },
        { onConflict: 'user_id,platform' }
    );

    if (error) {
        throw error;
    }
}

async function updateExistingSubscription(
    supabase: AdminClient,
    subscription: Stripe.Subscription,
    status: Stripe.Subscription.Status = subscription.status
) {
    const { error } = await supabase
        .from('subscriptions')
        .update(getSubscriptionState(subscription, status))
        .eq('stripe_subscription_id', subscription.id);

    if (error) {
        throw error;
    }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
    if (invoice.parent?.type !== 'subscription_details') {
        return null;
    }

    return getExpandableId(
        invoice.parent.subscription_details?.subscription || null
    );
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
    const identity = getSubscriptionIdentity(subscription);

    if (!identity) {
        console.error('Missing metadata in subscription:', subscription.id);
        return;
    }

    const supabase = createAdminClient();

    if (await isTerminalRegression(supabase, subscription, subscription.status)) {
        console.log(`Ignoring stale subscription creation: ${subscription.id}`);
        return;
    }

    // Upsert makes repeated deliveries and update-before-create delivery safe.
    await upsertSubscription(supabase, subscription, identity);
    await syncProfileAccess(
        supabase,
        subscription.id,
        subscription.status,
        identity
    );

    console.log(
        `Subscription created in database for user ${identity.userId}, tier ${identity.tier}`
    );
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const supabase = createAdminClient();
    const identity = getSubscriptionIdentity(subscription);

    if (await isTerminalRegression(supabase, subscription, subscription.status)) {
        console.log(`Ignoring stale subscription update: ${subscription.id}`);
        return;
    }

    if (identity) {
        await upsertSubscription(supabase, subscription, identity);
    } else {
        await updateExistingSubscription(supabase, subscription);
    }

    await syncProfileAccess(
        supabase,
        subscription.id,
        subscription.status,
        identity
    );

    console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const supabase = createAdminClient();
    const identity = getSubscriptionIdentity(subscription);

    if (identity) {
        await upsertSubscription(supabase, subscription, identity, 'canceled');
    } else {
        await updateExistingSubscription(supabase, subscription, 'canceled');
    }

    await syncProfileAccess(supabase, subscription.id, 'canceled', identity);

    console.log(`Subscription canceled: ${subscription.id}`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);

    if (!subscriptionId) {
        return;
    }

    const supabase = createAdminClient();
    const stored = await getStoredSubscription(supabase, subscriptionId);

    // Subscription lifecycle events are authoritative for terminal states.
    // This prevents a delayed invoice event from resurrecting a canceled row.
    if (
        !stored ||
        irreversibleStatuses.has(stored.status as Stripe.Subscription.Status) ||
        stored.status === 'paused'
    ) {
        return;
    }

    const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        throw error;
    }

    await updateProfileTier(
        supabase,
        stored.user_id,
        stored.tier as SubscriptionTier
    );

    console.log(`Payment succeeded for subscription: ${subscriptionId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);

    if (!subscriptionId) {
        return;
    }

    const supabase = createAdminClient();
    const stored = await getStoredSubscription(supabase, subscriptionId);

    if (
        !stored ||
        irreversibleStatuses.has(stored.status as Stripe.Subscription.Status) ||
        stored.status === 'paused'
    ) {
        return;
    }

    const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        throw error;
    }

    console.log(`Payment failed for subscription: ${subscriptionId}`);
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    });
}
