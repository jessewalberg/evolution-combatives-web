/**
 * One reconciliation path for Stripe subscription and invoice events.
 *
 * The event payload is not the source of truth. We re-read the subscription,
 * list every recorded customer, and choose the highest active tier. That
 * fresh snapshot is what we write, not the event order. Stripe search is
 * discovery only: a hit counts after per-customer list confirms it. The
 * database write updates the subscription and effective profile tier in one
 * transaction.
 */

import { tierForConfiguredPriceId } from '@/src/lib/stripe-price-config'
import { SUBSCRIPTION_TIER_HIERARCHY, type SubscriptionTier } from '@/src/lib/shared/constants/subscriptionTiers'

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
    searchByUserId(userId: string): Promise<StripeSubscriptionLike[]>
    listByCustomer(customerId: string): Promise<StripeSubscriptionLike[]>
}

export interface EntitlementApplyInput {
    expectedVersion: number
    eventId: string
    eventCreated: number
    userId: string
    stripeSubscriptionId: string
    stripeCustomerId: string
    customerIds: string[]
    subscriptionCreated: number
    tier: SubscriptionTier
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
}

export interface EntitlementDb {
    /** Null when the member has no profile row. Read this before the Stripe read. */
    readVersion(userId: string): Promise<number | null>
    listCustomerIds(userId: string): Promise<string[]>
    ownerForCustomer(customerId: string): Promise<string | null>
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
    | 'search_lag'

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

function tierOf(sub: StripeSubscriptionLike): SubscriptionTier | null {
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
        const activeTier = (sub: StripeSubscriptionLike) => isCurrent(sub)
            ? SUBSCRIPTION_TIER_HIERARCHY[tierOf(sub) ?? 'none']
            : 0
        const rank = activeTier(b) - activeTier(a)
        if (rank !== 0) return rank
        const active = Number(isCurrent(b)) - Number(isCurrent(a))
        if (active !== 0) return active
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
    recordedCustomerIds: string[],
    soleOwnerCustomerIds: Set<string>,
): Promise<{ subscriptions: StripeSubscriptionLike[]; searchComplete: boolean }> {
    const eventCustomerId = customerIdOf(retrieved)
    const listedCustomers = new Set<string>()
    const listedIds = new Set<string>()
    const combined = new Map<string, StripeSubscriptionLike>()

    const accepts = (customerId: string, sub: StripeSubscriptionLike): boolean => {
        const metadataOwner = metadataUserId(sub)
        return metadataOwner === owner || (metadataOwner === null && soleOwnerCustomerIds.has(customerId))
    }

    const listCustomer = async (customerId: string): Promise<void> => {
        if (listedCustomers.has(customerId)) return
        const subs = await source.listByCustomer(customerId)
        listedCustomers.add(customerId)
        for (const sub of subs) {
            if (!sub.id) continue
            listedIds.add(sub.id)
            if (accepts(customerId, sub)) combined.set(sub.id, sub)
        }
    }

    for (const customerId of recordedCustomerIds) {
        await listCustomer(customerId)
    }
    if (eventCustomerId) await listCustomer(eventCustomerId)

    const retrievedOwned = Boolean(retrieved.id) && (
        metadataUserId(retrieved) === owner
        || (metadataUserId(retrieved) === null && eventCustomerId != null && soleOwnerCustomerIds.has(eventCustomerId))
    )
    if (retrievedOwned) {
        combined.set(retrieved.id, retrieved)
    }

    const searched = await source.searchByUserId(owner)
    let searchComplete = true
    for (const sub of searched) {
        if (metadataUserId(sub) !== owner) {
            searchComplete = false
            continue
        }
        const searchedCustomer = customerIdOf(sub)
        if (!sub.id || !searchedCustomer) {
            searchComplete = false
            continue
        }
        if (!listedCustomers.has(searchedCustomer)) {
            await listCustomer(searchedCustomer)
        }
        if (!listedIds.has(sub.id)) searchComplete = false
    }

    if (retrievedOwned) combined.set(retrieved.id, retrieved)

    return { subscriptions: [...combined.values()], searchComplete }
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
    const eventCustomerId = customerIdOf(peeked)
    const owner = metadataUserId(peeked) ?? (eventCustomerId ? await db.ownerForCustomer(eventCustomerId) : null)
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
        const recordedCustomerIds = await db.listCustomerIds(owner)
        const soleOwnerCustomerIds = new Set<string>()
        for (const id of recordedCustomerIds) {
            if (await db.ownerForCustomer(id) === owner) soleOwnerCustomerIds.add(id)
        }
        const retrievedCustomerId = customerIdOf(retrieved)
        if (metadataUserId(retrieved) !== owner
            && !(metadataUserId(retrieved) === null && retrievedCustomerId && soleOwnerCustomerIds.has(retrievedCustomerId))) {
            console.error(`Stripe event ${event.id} subscription ${subscriptionId} is not owned by ${owner}`)
            return outcome('unresolved')
        }

        let snapshot: Awaited<ReturnType<typeof ownedSubscriptions>>
        try {
            snapshot = await ownedSubscriptions(source, retrieved, owner, recordedCustomerIds, soleOwnerCustomerIds)
        } catch (error) {
            console.error(`Stripe event ${event.id} member ${owner} snapshot could not be completed`, error)
            return outcome('search_lag', true)
        }
        const subscriptions = snapshot.subscriptions
        if (!snapshot.searchComplete) {
            console.error(`Stripe event ${event.id} member ${owner} search did not match customer lists`)
            return outcome('search_lag', true)
        }
        const selected = selectCurrent(subscriptions)
        if (!selected) {
            console.error(`Stripe event ${event.id} did not resolve a subscription owned by ${owner}`)
            return outcome('unresolved')
        }

        const tier = tierOf(selected)
        const customerId = customerIdOf(selected)
        if (!customerId || !STATUSES.has(selected.status)) {
            console.error(`Stripe event ${event.id} subscription ${selected.id} has no usable customer or status`)
            return outcome('unresolved')
        }

        const customerIds = [...new Set([
            ...recordedCustomerIds,
            ...(eventCustomerId ? [eventCustomerId] : []),
            ...subscriptions.map(customerIdOf).filter((id): id is string => id != null),
        ])]

        const result = await db.apply({
            expectedVersion: version,
            eventId: event.id,
            eventCreated: event.created,
            userId: owner,
            stripeSubscriptionId: selected.id,
            stripeCustomerId: customerId,
            customerIds,
            subscriptionCreated: readUnix(selected.created) ?? 0,
            tier: isCurrent(selected) ? (tier ?? 'none') : 'none',
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
