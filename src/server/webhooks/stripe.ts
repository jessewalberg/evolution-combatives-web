/**
 * Evolution Combatives - Stripe Webhook Handler
 * Processes Stripe webhook events for subscription management
 *
 * @description Secure webhook endpoint for handling Stripe subscription events
 * @author Evolution Combatives
 */

import { getStripe, validateWebhookSignature } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'
import { json } from '@/src/lib/http'
import type Stripe from 'stripe'
import {
    reconcileStripeWebhookEvent,
    type EntitlementApplyInput,
    type EntitlementDb,
    type StripeSubscriptionLike,
    type StripeSubscriptionSource,
} from '@/src/server/webhooks/stripe-reconcile'

const RECONCILE_TYPES = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
])

function rpcResult(data: unknown): string {
    const value = typeof data === 'string' ? JSON.parse(data) : data
    if (!value || typeof value !== 'object' || typeof (value as { result?: unknown }).result !== 'string') {
        throw new Error('reconcile_stripe_entitlement returned an unexpected payload')
    }
    return (value as { result: string }).result
}

export function createSupabaseEntitlementDb(): EntitlementDb {
    const supabase = createAdminClient()
    return {
        async readVersion(userId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('stripe_reconcile_version')
                .eq('id', userId)
                .maybeSingle()
            if (error) throw error
            if (!data) return null
            const version = Number(data.stripe_reconcile_version ?? 0)
            if (!Number.isFinite(version)) {
                throw new Error('invalid stripe reconcile version')
            }
            return version
        },
        async listCustomerIds(userId) {
            const { data, error } = await supabase
                .from('stripe_customers')
                .select('stripe_customer_id')
                .eq('user_id', userId)
            if (error) throw error
            return (data ?? []).map((row) => row.stripe_customer_id)
        },
        async ownerForCustomer(customerId) {
            const { data, error } = await supabase
                .from('stripe_customers')
                .select('user_id')
                .eq('stripe_customer_id', customerId)
                .limit(2)
            if (error) throw error
            return data?.length === 1 ? data[0].user_id : null
        },
        async apply(input: EntitlementApplyInput) {
            const { data, error } = await supabase.rpc('reconcile_stripe_entitlement', {
                p_user_id: input.userId,
                p_expected_version: input.expectedVersion,
                p_event_id: input.eventId,
                p_event_created: input.eventCreated,
                p_stripe_subscription_id: input.stripeSubscriptionId,
                p_stripe_customer_id: input.stripeCustomerId,
                p_customer_ids: input.customerIds,
                p_subscription_created: input.subscriptionCreated,
                p_tier: input.tier,
                p_status: input.status,
                p_current_period_start: input.currentPeriodStart,
                p_current_period_end: input.currentPeriodEnd,
                p_cancel_at_period_end: input.cancelAtPeriodEnd,
                p_canceled_at: input.canceledAt,
            })
            if (error) throw error
            return rpcResult(data)
        },
    }
}

export function liveStripeSubscriptionSource(): StripeSubscriptionSource {
    return {
        async retrieve(id) {
            const subscription = await getStripe().subscriptions.retrieve(id)
            return subscription as unknown as StripeSubscriptionLike
        },
        async searchByUserId(userId) {
            const collected: StripeSubscriptionLike[] = []
            let pageToken: string | undefined
            for (let page = 0; page < 10; page++) {
                const result = await getStripe().subscriptions.search({
                    query: `metadata['userId']:'${userId}'`,
                    limit: 100,
                    ...(pageToken ? { page: pageToken } : {}),
                })
                collected.push(...(result.data as unknown as StripeSubscriptionLike[]))
                if (!result.has_more) return collected
                pageToken = result.next_page ?? undefined
                if (!pageToken) break
            }
            throw new Error('Stripe subscription search exceeded 10 pages')
        },
        async listByCustomer(customerId) {
            const collected: StripeSubscriptionLike[] = []
            let startingAfter: string | undefined
            for (let page = 0; page < 10; page++) {
                const list = await getStripe().subscriptions.list({
                    customer: customerId,
                    status: 'all',
                    limit: 100,
                    ...(startingAfter ? { starting_after: startingAfter } : {}),
                })
                collected.push(...(list.data as unknown as StripeSubscriptionLike[]))
                if (!list.has_more || list.data.length === 0) return collected
                startingAfter = list.data[list.data.length - 1]?.id
                if (!startingAfter) return collected
            }
            throw new Error('Stripe subscription list exceeded 10 pages')
        },
    }
}

export async function POST({ request }: { request: Request }) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET environment variable is required')
        return json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
        console.error('Missing Stripe signature header')
        return json({ error: 'Missing signature' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
        event = await validateWebhookSignature(body, signature, webhookSecret)
    } catch (error) {
        console.error('Webhook signature verification failed')
        return json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        console.log(`Received Stripe webhook: ${event.type}, ID: ${event.id}`)

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session
            if (!session.metadata?.userId || !session.metadata?.tier) {
                console.error(`Checkout session ${session.id} missing metadata`)
            } else {
                console.log(`Checkout completed for session ${session.id}`)
            }
        } else if (RECONCILE_TYPES.has(event.type)) {
            const result = await reconcileStripeWebhookEvent(
                event,
                liveStripeSubscriptionSource(),
                createSupabaseEntitlementDb(),
            )
            if (result.retryable) {
                console.error(`Stripe reconcile retryable failure ${result.status} for ${event.id}`)
                return json({ error: 'Webhook handler failed' }, { status: 500 })
            }
        } else {
            console.log(`Unhandled webhook event type: ${event.type}`)
        }

        return json({ received: true })
    } catch (error) {
        console.error('Webhook error:', error)
        return json({ error: 'Webhook handler failed' }, { status: 500 })
    }
}

export async function GET() {
    return json({
        status: 'ok',
        service: 'stripe-webhooks',
        timestamp: new Date().toISOString(),
    })
}
