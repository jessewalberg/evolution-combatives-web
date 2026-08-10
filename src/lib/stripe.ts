/**
 * Evolution Combatives - Stripe Server Configuration
 * Server-side Stripe client for handling payments and subscriptions
 * 
 * @description Secure server-side Stripe integration for subscription management
 * @author Evolution Combatives
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Lazily construct the server-side Stripe client. On Cloudflare Workers,
 * env vars are only guaranteed present at request time, so the client must
 * not be built at module scope.
 */
export function getStripe(): Stripe {
    if (!stripeInstance) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        // Workers has no Node http agent; use the SDK's fetch client (guarded
        // because unit tests mock the module without the static factory).
        const httpClient =
            typeof Stripe.createFetchHttpClient === 'function' ? Stripe.createFetchHttpClient() : undefined;
        stripeInstance = new Stripe(secretKey, {
            // Uses the API version pinned by the installed SDK
            typescript: true,
            ...(httpClient ? { httpClient } : {}),
        });
    }
    return stripeInstance;
}

/**
 * Server-side Stripe client instance (lazy proxy over getStripe so legacy
 * `import { stripe }` call sites keep working).
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        const instance = getStripe();
        const value = instance[prop as keyof Stripe];
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
    },
});

/**
 * Stripe webhook signature validation
 * Ensures webhooks are coming from Stripe. Async because Workers only
 * supports the WebCrypto-based constructEventAsync.
 */
export const validateWebhookSignature = async (
    payload: string,
    signature: string,
    secret: string
): Promise<Stripe.Event> => {
    try {
        return await getStripe().webhooks.constructEventAsync(payload, signature, secret);
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
