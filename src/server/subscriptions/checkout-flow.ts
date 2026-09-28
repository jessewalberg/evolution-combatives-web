/**
 * Shared Stripe checkout reservation flow for web and mobile endpoints.
 * Serializes checkout per user via reserve_stripe_checkout (Postgres advisory lock).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe';
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
    if (count !== null && count > 1) {
        console.error('Ambiguous subscription state: multiple non-terminal rows for user', userId);
        return { ok: false, status: 500, error: 'Unable to verify subscription status' };
    }
    if (rows.length > 1) {
        console.error('Ambiguous subscription state: multiple non-terminal rows for user', userId);
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

    return { ok: true };
}

type ReserveResult =
    | { action: 'reuse'; sessionId: string; url: string }
    | { action: 'create'; idempotencyKey: string };

function mapReserveError(code: string | undefined): { status: 400 | 500; error: string } {
    switch (code) {
        case 'subscription_in_progress':
            return { status: 400, error: 'User already has a subscription in progress' };
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
        if (!payload.session_id || !payload.url) {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
        return {
            ok: true,
            result: { action: 'reuse', sessionId: payload.session_id, url: payload.url },
        };
    }

    if (payload.action !== 'create' || !payload.idempotency_key) {
        return { ok: false, status: 500, error: 'Unable to start checkout' };
    }

    return {
        ok: true,
        result: {
            action: 'create',
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
    | { ok: true; sessionId: string; url: string; reused: boolean }
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
            reused: true,
        };
    }

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

        const expiresAt = session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: finalized, error: finalizeError } = await adminRpc(admin, 'finalize_stripe_checkout_reservation', {
            p_user_id: userId,
            p_idempotency_key: reserved.result.idempotencyKey,
            p_checkout_session_id: session.id,
            p_checkout_session_url: session.url ?? '',
            p_expires_at: expiresAt,
        });

        if (finalizeError || finalized !== true) {
            console.error('finalize_stripe_checkout_reservation RPC error:', finalizeError);
            await adminRpc(admin, 'release_stripe_checkout_reservation', {
                p_user_id: userId,
                p_idempotency_key: reserved.result.idempotencyKey,
            });
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }

        if (!session.url) {
            await adminRpc(admin, 'release_stripe_checkout_reservation', {
                p_user_id: userId,
                p_idempotency_key: reserved.result.idempotencyKey,
            });
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }

        return { ok: true, sessionId: session.id, url: session.url, reused: false };
    } catch (err) {
        console.error('Stripe checkout session creation failed:', err);
        await adminRpc(admin, 'release_stripe_checkout_reservation', {
            p_user_id: userId,
            p_idempotency_key: reserved.result.idempotencyKey,
        });
        return { ok: false, status: 500, error: 'Payment processing error' };
    }
}
