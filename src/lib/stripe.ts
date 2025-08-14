/**
 * Evolution Combatives - Stripe Server Configuration
 * Server-side Stripe client for handling payments and subscriptions
 * 
 * @description Secure server-side Stripe integration for subscription management
 * @author Evolution Combatives
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

/**
 * Server-side Stripe client instance
 * Used for creating checkout sessions, handling webhooks, and managing subscriptions
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil', // Use latest stable API version
    typescript: true,
});

/**
 * Stripe webhook signature validation
 * Ensures webhooks are coming from Stripe
 */
export const validateWebhookSignature = (
    payload: string | Buffer,
    signature: string,
    secret: string
): Stripe.Event => {
    try {
        return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
        const error = err as Error;
        throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
};

/**
 * Create a checkout session for subscription
 */
export const createCheckoutSession = async ({
    priceId,
    customerId,
    userId,
    tier,
    successUrl,
    cancelUrl,
}: {
    priceId: string;
    customerId?: string;
    userId: string;
    tier: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<Stripe.Checkout.Session> => {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            userId,
            tier,
        },
        subscription_data: {
            metadata: {
                userId,
                tier,
            },
        },
    };

    // If customer exists, use it; otherwise let Stripe create a new one
    if (customerId) {
        sessionParams.customer = customerId;
    } else {
        sessionParams.customer_creation = 'always';
    }

    return await stripe.checkout.sessions.create(sessionParams);
};

/**
 * Retrieve a customer by email or create a new one
 */
export const getOrCreateCustomer = async (email: string, userId: string): Promise<Stripe.Customer> => {
    // First, try to find existing customer by email
    const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
    });

    if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
    }

    // Create new customer
    return await stripe.customers.create({
        email,
        metadata: {
            userId,
        },
    });
};

/**
 * Get subscription details
 */
export const getSubscription = async (subscriptionId: string): Promise<Stripe.Subscription> => {
    return await stripe.subscriptions.retrieve(subscriptionId);
};

/**
 * Cancel subscription at period end
 */
export const cancelSubscription = async (subscriptionId: string): Promise<Stripe.Subscription> => {
    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
    });
};

/**
 * Reactivate a subscription that was set to cancel at period end
 */
export const reactivateSubscription = async (subscriptionId: string): Promise<Stripe.Subscription> => {
    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
    });
};

/**
 * Update subscription to a different price/tier
 */
export const updateSubscription = async (
    subscriptionId: string,
    newPriceId: string,
    tier: string
): Promise<Stripe.Subscription> => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.subscriptions.update(subscriptionId, {
        items: [
            {
                id: subscription.items.data[0].id,
                price: newPriceId,
            },
        ],
        metadata: {
            ...subscription.metadata,
            tier,
        },
        proration_behavior: 'create_prorations',
    });
};
