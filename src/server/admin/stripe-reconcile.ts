/**
 * Admin Stripe Reconciliation Service
 *
 * Identifies paid members who have active Stripe subscriptions but no
 * corresponding database row, and triggers reconciliation via the
 * existing webhook handler logic.
 */

import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { json } from '@/src/lib/http'
import { getStripe } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'
import {
    reconcileStripeWebhookEvent,
    type StripeEventLike,
} from '@/src/server/webhooks/stripe-reconcile'
import {
    createSupabaseEntitlementDb,
    liveStripeSubscriptionSource,
} from '@/src/server/webhooks/stripe'

interface MissingSubscriptionRow {
    userId: string
    email: string | null
    stripeSubscriptionId: string
    stripeCustomerId: string
    status: string
    tier: string | null
}

interface ReconciliationResult {
    subscriptionId: string
    userId: string
    status: 'reconciled' | 'failed' | 'skipped'
    message: string
}

interface ReconciliationReport {
    totalStripeSubscriptions: number
    activeSubscriptions: number
    missingRows: number
    reconciled: number
    failed: number
    skipped: number
    details: ReconciliationResult[]
}

async function findMissingSubscriptionRows(): Promise<MissingSubscriptionRow[]> {
    const stripe = getStripe()
    const supabase = createAdminClient()
    const missing: MissingSubscriptionRow[] = []

    let startingAfter: string | undefined

    for (let page = 0; page < 100; page++) {
        const list = await stripe.subscriptions.list({
            status: 'all',
            limit: 100,
            expand: ['data.items.data.price'],
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        })

        for (const sub of list.data) {
            if (sub.status !== 'active' && sub.status !== 'trialing') {
                continue
            }

            const userId = sub.metadata?.userId
            if (!userId) {
                continue
            }

            const customerId = typeof sub.customer === 'string'
                ? sub.customer
                : sub.customer?.id

            if (!customerId) {
                continue
            }

            const { data: existingRow } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .eq('platform', 'stripe')
                .maybeSingle()

            if (!existingRow) {
                const priceId = sub.items?.data?.[0]?.price
                const tier = typeof priceId === 'object' ? priceId?.id : priceId

                missing.push({
                    userId,
                    email: null,
                    stripeSubscriptionId: sub.id,
                    stripeCustomerId: customerId,
                    status: sub.status,
                    tier: tier || null,
                })
            }
        }

        if (!list.has_more || list.data.length === 0) {
            break
        }
        startingAfter = list.data[list.data.length - 1]?.id
        if (!startingAfter) break
    }

    return missing
}

async function reconcileMissingRow(
    missing: MissingSubscriptionRow
): Promise<ReconciliationResult> {
    const syntheticEvent: StripeEventLike = {
        id: `reconcile_${missing.stripeSubscriptionId}_${Date.now()}`,
        type: 'customer.subscription.updated',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: missing.stripeSubscriptionId,
                customer: missing.stripeCustomerId,
                status: missing.status,
                metadata: { userId: missing.userId },
            },
        },
    }

    try {
        const result = await reconcileStripeWebhookEvent(
            syntheticEvent,
            liveStripeSubscriptionSource(),
            createSupabaseEntitlementDb()
        )

        if (result.status === 'applied') {
            return {
                subscriptionId: missing.stripeSubscriptionId,
                userId: missing.userId,
                status: 'reconciled',
                message: 'Subscription row created successfully',
            }
        } else if (result.status === 'duplicate') {
            return {
                subscriptionId: missing.stripeSubscriptionId,
                userId: missing.userId,
                status: 'skipped',
                message: 'Row already exists (duplicate)',
            }
        } else if (result.status === 'stale') {
            return {
                subscriptionId: missing.stripeSubscriptionId,
                userId: missing.userId,
                status: 'skipped',
                message: 'Concurrent update detected (stale)',
            }
        } else {
            return {
                subscriptionId: missing.stripeSubscriptionId,
                userId: missing.userId,
                status: 'failed',
                message: `Reconciliation returned: ${result.status}`,
            }
        }
    } catch (error) {
        return {
            subscriptionId: missing.stripeSubscriptionId,
            userId: missing.userId,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

export async function POST({ request }: { request: Request }) {
    const authResult = await validateApiAuthWithSession('admin.all')
    if ('error' in authResult) {
        return authResult.error
    }

    let body: { action?: string; dryRun?: boolean }
    try {
        body = await request.json()
    } catch {
        return json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { action, dryRun = true } = body

    if (action === 'find-missing') {
        try {
            const missing = await findMissingSubscriptionRows()
            return json({
                success: true,
                data: {
                    missingCount: missing.length,
                    missing: missing.map(m => ({
                        userId: m.userId,
                        stripeSubscriptionId: m.stripeSubscriptionId,
                        status: m.status,
                    })),
                },
            })
        } catch (error) {
            console.error('Failed to find missing subscription rows:', error)
            return json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to scan subscriptions',
            }, { status: 500 })
        }
    }

    if (action === 'reconcile') {
        try {
            const missing = await findMissingSubscriptionRows()

            if (dryRun) {
                return json({
                    success: true,
                    data: {
                        dryRun: true,
                        wouldReconcile: missing.length,
                        missing: missing.map(m => ({
                            userId: m.userId,
                            stripeSubscriptionId: m.stripeSubscriptionId,
                            status: m.status,
                        })),
                    },
                })
            }

            const results: ReconciliationResult[] = []
            for (const row of missing) {
                const result = await reconcileMissingRow(row)
                results.push(result)
            }

            const report: ReconciliationReport = {
                totalStripeSubscriptions: 0,
                activeSubscriptions: missing.length,
                missingRows: missing.length,
                reconciled: results.filter(r => r.status === 'reconciled').length,
                failed: results.filter(r => r.status === 'failed').length,
                skipped: results.filter(r => r.status === 'skipped').length,
                details: results,
            }

            return json({ success: true, data: report })
        } catch (error) {
            console.error('Reconciliation failed:', error)
            return json({
                success: false,
                error: error instanceof Error ? error.message : 'Reconciliation failed',
            }, { status: 500 })
        }
    }

    return json({
        success: false,
        error: 'Invalid action. Use "find-missing" or "reconcile"',
    }, { status: 400 })
}

export async function GET() {
    return json({
        status: 'ok',
        service: 'stripe-reconcile',
        actions: ['find-missing', 'reconcile'],
        usage: {
            'find-missing': 'POST with { action: "find-missing" } to list members with active Stripe subscriptions but no database row',
            'reconcile': 'POST with { action: "reconcile", dryRun: false } to backfill missing rows',
        },
    })
}
