/**
 * Shared Stripe checkout reservation flow for web and mobile endpoints.
 * Serializes checkout per user via reserve_stripe_checkout (Postgres advisory lock).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe';
import { createAdminClient } from '@/src/lib/supabase';
import type { Database } from '@/src/lib/shared/types/database';

type AdminClient = SupabaseClient<Database>;

type UntypedAdmin = {
    rpc: (
        fn: string,
        args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
}

async function adminRpc(admin: AdminClient, fn: string, args: Record<string, unknown>) {
    return (admin as unknown as UntypedAdmin).rpc(fn, args)
}

export type NonTerminalSubscriptionCheck =
    | { ok: true }
    | { ok: false; status: 400 | 500; error: string; currentStatus?: string; currentTier?: string };

export async function assertSingleNonTerminalSubscription(
    supabase: SupabaseClient<Database>,
    userId: string,
): Promise<NonTerminalSubscriptionCheck> {
    const { data, error, count } = await supabase
        .from('subscriptions')
        .select('id, status, tier', { count: 'exact' })
        .eq('user_id', userId)
        .not('status', 'in', '(canceled,incomplete_expired,unpaid)');

    if (error) {
        console.error('Error checking existing subscription:', error);
        return { ok: false, status: 500, error: 'Unable to verify subscription status' };
    }

    const rows = (data ?? []) as Array<{ id: string; status: string; tier: string }>;
    if (count === null || count !== rows.length || rows.length > 1) {
        console.error('Ambiguous subscription state for user', userId);
        return { ok: false, status: 500, error: 'Unable to verify subscription status' };
    }

    if (rows.length === 1) {
        return {
            ok: false,
            status: 400,
            error: 'User already has a subscription in progress',
            currentStatus: rows[0].status,
            currentTier: rows[0].tier,
        };
    }

    try {
        const { count: orphanCount, error: orphanError } = await createAdminClient()
            .from('stripe_orphan_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('needs_refund', true)
            .is('resolved_at', null);

        if (orphanError || orphanCount === null) {
            console.error('Error checking unresolved Stripe payments:', orphanError);
            return { ok: false, status: 500, error: 'Unable to verify subscription status' };
        }
        if (orphanCount > 0) {
            return { ok: false, status: 400, error: 'Unresolved payment requires review' };
        }
    } catch (error) {
        console.error('Error checking unresolved Stripe payments:', error);
        return { ok: false, status: 500, error: 'Unable to verify subscription status' };
    }

    return { ok: true };
}

type ReserveResult =
    | { action: 'reuse'; reservationId: string; sessionId: string; url: string; expiresAt: string }
    | { action: 'create'; reservationId: string; idempotencyKey: string };

function mapReserveError(code: string | undefined): { status: 400 | 500; error: string } {
    switch (code) {
        case 'subscription_in_progress':
            return { status: 400, error: 'User already has a subscription in progress' };
        case 'unresolved_payment':
            return { status: 400, error: 'Unresolved payment requires review' };
        case 'ambiguous_subscription_state':
        case 'checkout_in_progress':
            return { status: 500, error: 'Unable to start checkout' };
        default:
            return { status: 500, error: 'Unable to start checkout' };
    }
}

export async function reserveOrReuseCheckoutSession(
    admin: AdminClient,
    userId: string,
    tier: string,
): Promise<{ ok: true; result: ReserveResult } | { ok: false; status: 400 | 500; error: string }> {
    const { data, error } = await adminRpc(admin, 'reserve_stripe_checkout', {
        p_user_id: userId,
        p_tier: tier,
    });

    if (error) {
        console.error('reserve_stripe_checkout RPC error:', error);
        return { ok: false, status: 500, error: 'Unable to start checkout' };
    }

    const payload = data as Record<string, string> | null;
    if (!payload || payload.error) {
        const mapped = mapReserveError(payload?.error);
        return { ok: false, ...mapped };
    }

    if (payload.action === 'reuse') {
        if (!payload.reservation_id || !payload.session_id || !payload.url || !payload.expires_at) {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
        return {
            ok: true,
            result: { action: 'reuse', reservationId: payload.reservation_id, sessionId: payload.session_id, url: payload.url, expiresAt: payload.expires_at },
        };
    }

    if (payload.action !== 'create' || !payload.reservation_id || !payload.idempotency_key) {
        return { ok: false, status: 500, error: 'Unable to start checkout' };
    }

    return {
        ok: true,
        result: {
            action: 'create',
            reservationId: payload.reservation_id,
            idempotencyKey: payload.idempotency_key,
        },
    };
}

export async function createReservedCheckoutSession(params: {
    admin: AdminClient;
    userId: string;
    userEmail: string;
    tier: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<
    | { ok: true; sessionId: string; url: string; expiresAt: string; reused: boolean }
    | { ok: false; status: 400 | 500; error: string; currentStatus?: string; currentTier?: string }
> {
    const { admin, userId, userEmail, tier, priceId, successUrl, cancelUrl } = params;

    const reserved = await reserveOrReuseCheckoutSession(admin, userId, tier);
    if (!reserved.ok) {
        return reserved;
    }

    if (reserved.result.action === 'reuse') {
        return {
            ok: true,
            sessionId: reserved.result.sessionId,
            url: reserved.result.url,
            expiresAt: reserved.result.expiresAt,
            reused: true,
        };
    }

    let sessionId: string | null = null;
    const releaseReservation = () => adminRpc(admin, 'release_stripe_checkout_reservation', {
        p_user_id: userId,
        p_reservation_id: reserved.result.reservationId,
        p_checkout_session_id: sessionId,
    });

    try {
        const customer = await getOrCreateCustomer(userEmail, userId);
        const session = await createCheckoutSession({
            priceId,
            customerId: customer.id,
            userId,
            tier,
            successUrl,
            cancelUrl,
            idempotencyKey: reserved.result.idempotencyKey,
        });
        sessionId = session.id;

        const expiresAt = new Date(session.expires_at * 1000).toISOString();

        const { data: finalized, error: finalizeError } = await adminRpc(admin, 'finalize_stripe_checkout_reservation', {
            p_user_id: userId,
            p_reservation_id: reserved.result.reservationId,
            p_checkout_session_id: session.id,
            p_checkout_session_url: session.url ?? '',
            p_expires_at: expiresAt,
        });

        if (finalizeError || finalized !== true) {
            console.error('finalize_stripe_checkout_reservation RPC error:', finalizeError);
            await releaseReservation();
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }

        if (!session.url) {
            await releaseReservation();
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }

        return { ok: true, sessionId: session.id, url: session.url, expiresAt, reused: false };
    } catch (err) {
        console.error('Stripe checkout session creation failed:', err);
        await releaseReservation();
        return { ok: false, status: 500, error: 'Payment processing error' };
    }
}
