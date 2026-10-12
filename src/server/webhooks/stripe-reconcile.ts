/**
 * One reconciliation path for Stripe subscription and invoice events.
 *
 * The event payload is not the source of truth. We re-read the subscription,
 * keep only subscriptions whose metadata.userId is that owner (a shared
 * customer is not ownership), and pick the current one: active or trialing
 * first, then the newest. The database write is one transaction that upserts
 * on (user_id, platform) and stripe_subscription_id, updates the profile tier
 * in the same transaction, and rejects a stale event so a delayed delivery
 * cannot restore a cancelled tier.
 */

import { tierForConfiguredPriceId, type PaidSubscriptionTier } from '@/src/lib/stripe-price-config'

const RECONCILE_ATTEMPTS = 5

const SUBSCRIPTION_EVENTS = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
])

const INVOICE_EVENTS = new Set([
    'invoice.payment_succeeded',
    'invoice.payment_failed',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUSES = new Set([
    'active',
    'canceled',
    'past_due',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'unpaid',
    'paused',
])

export interface StripeSubscriptionLike {
    id: string
    status: string
    created?: number
    customer?: string | { id?: string } | null
    metadata?: { userId?: string; tier?: string } | null
    cancel_at_period_end?: boolean
    canceled_at?: number | null
    current_period_start?: number
    current_period_end?: number
    items?: {
        data?: Array<{
            current_period_start?: number
            current_period_end?: number
            price?: string | { id?: string } | null
        }>
    }
}

export interface StripeEventLike {
    id: string
    type: string
    created: number
    data: { object: unknown }
}

export interface StripeSubscriptionSource {
    retrieve(id: string): Promise<StripeSubscriptionLike>
    /** Strongly consistent customer list. Caller filters on metadata.userId. */
    listByCustomer(customerId: string): Promise<StripeSubscriptionLike[]>
}

export interface EntitlementApplyInput {
    expectedVersion: number
    eventId: string
    eventCreated: number
    userId: string
    stripeSubscriptionId: string
    stripeCustomerId: string
    subscriptionCreated: number
    tier: PaidSubscriptionTier
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
}

export interface EntitlementDb {
    /** Null when the member has no profile row. Read this before the Stripe read. */
    readVersion(userId: string): Promise<number | null>
    apply(input: EntitlementApplyInput): Promise<string>
}

export type ReconcileStatus =
    | 'applied'
    | 'stale'
    | 'duplicate'
    | 'ownership_conflict'
    | 'missing_profile'
    | 'ignored'
    | 'unresolved'

export interface ReconcileOutcome {
    status: ReconcileStatus
    retryable: boolean
}

function outcome(status: ReconcileStatus, retryable = false): ReconcileOutcome {
    return { status, retryable }
}

function readUnix(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function unixToIso(unix: number | null): string | null {
    if (unix == null) return null
    const time = new Date(unix * 1000).getTime()
    if (!Number.isFinite(time)) return null
    return new Date(time).toISOString()
}

function periodUnix(sub: StripeSubscriptionLike, field: 'current_period_start' | 'current_period_end'): number | null {
    const top = readUnix(sub[field])
    if (top != null) return top
    const item = sub.items?.data?.[0]
    return readUnix(item?.[field])
}

function priceIdOf(sub: StripeSubscriptionLike): string | null {
    const price = sub.items?.data?.[0]?.price
    if (typeof price === 'string' && price) return price
    if (price && typeof price === 'object' && typeof price.id === 'string' && price.id) return price.id
    return null
}

function metadataUserId(sub: StripeSubscriptionLike): string | null {
    const value = sub.metadata?.userId
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed || null
}

function tierOf(sub: StripeSubscriptionLike): PaidSubscriptionTier | null {
    const meta = sub.metadata?.tier
    if (meta === 'tier1' || meta === 'tier2' || meta === 'tier3') return meta
    return tierForConfiguredPriceId(priceIdOf(sub))
}

function customerIdOf(sub: StripeSubscriptionLike): string | null {
    if (typeof sub.customer === 'string' && sub.customer) return sub.customer
    if (sub.customer && typeof sub.customer === 'object' && typeof sub.customer.id === 'string' && sub.customer.id) {
        return sub.customer.id
    }
    return null
}

function idFromStripeRef(value: unknown): string | null {
    if (typeof value === 'string' && value) return value
    if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
        const id = (value as { id: string }).id
        return id || null
    }
    return null
}

/** Basil moved invoice.subscription under parent.subscription_details. */
export function subscriptionIdFromEvent(event: StripeEventLike): string | null {
    const object = event.data.object
    if (!object || typeof object !== 'object') return null

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
        return idFromStripeRef((object as { id?: unknown }).id)
    }

    if (INVOICE_EVENTS.has(event.type)) {
        const invoice = object as {
            subscription?: unknown
            parent?: { subscription_details?: { subscription?: unknown } | null } | null
        }
        return idFromStripeRef(invoice.subscription)
            ?? idFromStripeRef(invoice.parent?.subscription_details?.subscription)
    }

    return null
}

function isCurrent(sub: StripeSubscriptionLike): boolean {
    return sub.status === 'active' || sub.status === 'trialing'
}

function selectCurrent(subscriptions: StripeSubscriptionLike[]): StripeSubscriptionLike | null {
    const owned = subscriptions.filter((sub) => sub.id && typeof sub.status === 'string')
    if (owned.length === 0) return null
    owned.sort((a, b) => {
        const rank = Number(isCurrent(b)) - Number(isCurrent(a))
        if (rank !== 0) return rank
        const created = (readUnix(b.created) ?? 0) - (readUnix(a.created) ?? 0)
        if (created !== 0) return created
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return owned[0]
}

async function ownedSubscriptions(
    source: StripeSubscriptionSource,
    retrieved: StripeSubscriptionLike,
    owner: string,
): Promise<StripeSubscriptionLike[]> {
    const customerId = customerIdOf(retrieved)
    const listed = customerId ? await source.listByCustomer(customerId) : []
    const combined = new Map<string, StripeSubscriptionLike>()
    for (const sub of listed) {
        if (metadataUserId(sub) === owner) combined.set(sub.id, sub)
    }
    if (metadataUserId(retrieved) === owner) {
        // Retrieved object wins over a list copy of the same id.
        combined.set(retrieved.id, retrieved)
    }
    return [...combined.values()]
}

function mapApplyResult(result: string): ReconcileOutcome {
    switch (result) {
        case 'applied':
            return outcome('applied')
        case 'stale':
            return outcome('stale')
        case 'duplicate':
            return outcome('duplicate')
        case 'ownership_conflict':
            return outcome('ownership_conflict')
        case 'missing_profile':
            return outcome('missing_profile', true)
        case 'retry':
            return outcome('unresolved', true)
        default:
            throw new Error(`reconcile_stripe_entitlement returned unexpected result ${result}`)
    }
}

export async function reconcileStripeWebhookEvent(
    event: StripeEventLike,
    source: StripeSubscriptionSource,
    db: EntitlementDb,
): Promise<ReconcileOutcome> {
    if (!SUBSCRIPTION_EVENTS.has(event.type) && !INVOICE_EVENTS.has(event.type)) {
        return outcome('ignored')
    }

    const subscriptionId = subscriptionIdFromEvent(event)
    if (!subscriptionId) {
        console.error(`Stripe event ${event.id} (${event.type}) has no subscription id`)
        return outcome('ignored')
    }

    if (!Number.isFinite(event.created)) {
        console.error(`Stripe event ${event.id} has no created timestamp`)
        return outcome('unresolved')
    }

    // Peek only to learn the owner. The snapshot we write is read below,
    // after the member version, so a stale read cannot be committed.
    const peeked = await source.retrieve(subscriptionId)
    const owner = metadataUserId(peeked)
    if (!owner || !UUID_RE.test(owner)) {
        console.error(`Stripe event ${event.id} subscription ${subscriptionId} has no usable metadata.userId`)
        return outcome('unresolved')
    }

    for (let attempt = 0; attempt < RECONCILE_ATTEMPTS; attempt++) {
        const version = await db.readVersion(owner)
        if (version === null) {
            console.error(`Stripe event ${event.id} member ${owner} has no profile`)
            return outcome('missing_profile', true)
        }

        const retrieved = await source.retrieve(subscriptionId)
        if (metadataUserId(retrieved) !== owner) {
            console.error(`Stripe event ${event.id} subscription ${subscriptionId} is not owned by ${owner}`)
            return outcome('unresolved')
        }

        const selected = selectCurrent(await ownedSubscriptions(source, retrieved, owner))
        if (!selected || metadataUserId(selected) !== owner) {
            console.error(`Stripe event ${event.id} did not resolve a subscription owned by ${owner}`)
            return outcome('unresolved')
        }

        const tier = tierOf(selected)
        const customerId = customerIdOf(selected)
        if (!tier || !customerId || !STATUSES.has(selected.status)) {
            console.error(`Stripe event ${event.id} subscription ${selected.id} has no usable tier or status`)
            return outcome('unresolved')
        }

        const result = await db.apply({
            expectedVersion: version,
            eventId: event.id,
            eventCreated: event.created,
            userId: owner,
            stripeSubscriptionId: selected.id,
            stripeCustomerId: customerId,
            subscriptionCreated: readUnix(selected.created) ?? 0,
            tier,
            status: selected.status,
            currentPeriodStart: unixToIso(periodUnix(selected, 'current_period_start')),
            currentPeriodEnd: unixToIso(periodUnix(selected, 'current_period_end')),
            cancelAtPeriodEnd: selected.cancel_at_period_end === true,
            canceledAt: unixToIso(readUnix(selected.canceled_at)),
        })

        if (result === 'retry') continue

        const mapped = mapApplyResult(result)
        if (mapped.status === 'ownership_conflict' || mapped.status === 'stale') {
            console.error(`Stripe event ${event.id} member ${owner} reconcile ${mapped.status} for ${selected.id}`)
        } else {
            console.log(`Stripe event ${event.id} member ${owner} reconcile ${mapped.status} for ${selected.id}`)
        }
        return mapped
    }

    throw new Error(`Stripe entitlement reconcile for ${event.id} conflicted too many times`)
}
