/**
 * Shared Stripe checkout reservation flow for web and mobile endpoints.
 * Serializes checkout per user via reserve_stripe_checkout (Postgres advisory lock).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createCheckoutSession, getOrCreateCustomer, stripe } from '@/src/lib/stripe';
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
    | { action: 'inspect'; reservationId: string; sessionId: string }
    | { action: 'create'; reservationId: string; idempotencyKey: string }
    | { action: 'inspect_pending'; reservationId: string; idempotencyKey: string; tier: string; priceId: string; successUrl: string; cancelUrl: string; userEmail: string };

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

function isDefiniteStripeRejection(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('type' in error)) return false;
    return error.type === 'StripeInvalidRequestError'
        || error.type === 'StripeAuthenticationError'
        || error.type === 'StripePermissionError';
}

export async function reserveOrReuseCheckoutSession(
    admin: AdminClient,
    userId: string,
    userEmail: string,
    tier: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
): Promise<{ ok: true; result: ReserveResult } | { ok: false; status: 400 | 500; error: string }> {
    const { data, error } = await adminRpc(admin, 'reserve_stripe_checkout', {
        p_user_id: userId,
        p_tier: tier,
        p_request_fingerprint: JSON.stringify([priceId, successUrl, cancelUrl, userEmail]),
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

    if (payload.action === 'inspect') {
        if (!payload.reservation_id || !payload.session_id) {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
        return {
            ok: true,
            result: { action: 'inspect', reservationId: payload.reservation_id, sessionId: payload.session_id },
        };
    }

    if (payload.action === 'inspect_pending') {
        if (!payload.reservation_id || !payload.idempotency_key || !payload.tier || !payload.request_fingerprint) {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
        try {
            const request = JSON.parse(payload.request_fingerprint) as unknown;
            if (!Array.isArray(request) || request.length !== 4
                || request.some((value) => typeof value !== 'string' || value === '')) {
                return { ok: false, status: 500, error: 'Unable to start checkout' };
            }
            return {
                ok: true,
                result: {
                    action: 'inspect_pending', reservationId: payload.reservation_id,
                    idempotencyKey: payload.idempotency_key, tier: payload.tier,
                    priceId: request[0], successUrl: request[1], cancelUrl: request[2], userEmail: request[3],
                },
            };
        } catch {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
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

type CheckoutAttempt = { reservationId: string; idempotencyKey: string };
type CheckoutRequest = { userEmail: string; tier: string; priceId: string; successUrl: string; cancelUrl: string };

async function runCheckoutAttempt(
    admin: AdminClient,
    userId: string,
    attempt: CheckoutAttempt,
    request: CheckoutRequest,
    inspectExisting: boolean,
): Promise<
    | { state: 'ready'; sessionId: string; url: string; expiresAt: string }
    | { state: 'released' | 'blocked'; error: string }
> {
    const release = async () => {
        try {
            const result = await adminRpc(admin, 'release_stripe_checkout_reservation', {
                p_user_id: userId,
                p_reservation_id: attempt.reservationId,
            });
            return !result.error && result.data === true;
        } catch (error) {
            console.error('Unable to release Stripe checkout reservation:', error);
            return false;
        }
    };

    let customerId: string;
    try {
        customerId = (await getOrCreateCustomer(request.userEmail, userId)).id;
    } catch (error) {
        console.error('Stripe customer lookup failed:', error);
        if (inspectExisting) return { state: 'blocked', error: 'Payment processing error' };
        return { state: await release() ? 'released' : 'blocked', error: 'Payment processing error' };
    }

    let session: Awaited<ReturnType<typeof createCheckoutSession>>;
    try {
        session = await createCheckoutSession({
            priceId: request.priceId,
            customerId,
            userId,
            tier: request.tier,
            successUrl: request.successUrl,
            cancelUrl: request.cancelUrl,
            idempotencyKey: attempt.idempotencyKey,
        });
    } catch (error) {
        console.error('Stripe checkout session creation failed:', error);
        if (isDefiniteStripeRejection(error)) {
            return { state: await release() ? 'released' : 'blocked', error: 'Payment processing error' };
        }
        try {
            await adminRpc(admin, 'mark_stripe_checkout_retryable', {
                p_user_id: userId,
                p_reservation_id: attempt.reservationId,
            });
        } catch (markError) {
            console.error('Unable to mark Stripe checkout retryable:', markError);
        }
        return { state: 'blocked', error: 'Payment processing error' };
    }

    if (inspectExisting) {
        try {
            session = await stripe.checkout.sessions.retrieve(session.id);
        } catch (error) {
            console.error('Unable to inspect pending Stripe checkout session:', error);
            return { state: 'blocked', error: 'Unable to start checkout' };
        }
        if (session.status === 'expired') {
            return { state: await release() ? 'released' : 'blocked', error: 'Unable to start checkout' };
        }
        if (session.status !== 'open' && session.status !== 'complete') {
            return { state: 'blocked', error: 'Unable to start checkout' };
        }
    }

    if (!session.url && session.status !== 'complete') {
        try {
            await stripe.checkout.sessions.expire(session.id);
        } catch (error) {
            console.error('Unable to expire Stripe checkout session:', error);
            try {
                const current = await stripe.checkout.sessions.retrieve(session.id);
                if (current.status !== 'expired') {
                    return { state: 'blocked', error: 'Unable to start checkout' };
                }
            } catch {
                return { state: 'blocked', error: 'Unable to start checkout' };
            }
        }
        return { state: await release() ? 'released' : 'blocked', error: 'Unable to start checkout' };
    }

    try {
        const expiresAt = new Date(session.expires_at * 1000).toISOString();
        const { data, error } = await adminRpc(admin, 'finalize_stripe_checkout_reservation', {
            p_user_id: userId,
            p_reservation_id: attempt.reservationId,
            p_checkout_session_id: session.id,
            p_checkout_session_url: session.url,
            p_expires_at: expiresAt,
        });
        if (error || data !== true) {
            console.error('finalize_stripe_checkout_reservation RPC error:', error);
            return { state: 'blocked', error: 'Unable to start checkout' };
        }
        if (session.status === 'complete') {
            const subscriptionId = typeof session.subscription === 'string'
                ? session.subscription : session.subscription?.id;
            if (subscriptionId) {
                await adminRpc(admin, 'consume_stripe_checkout', {
                    p_user_id: userId,
                    p_checkout_session_id: session.id,
                    p_stripe_subscription_id: subscriptionId,
                });
            }
            return { state: 'blocked', error: 'Unable to start checkout' };
        }
        if (!session.url) return { state: 'blocked', error: 'Unable to start checkout' };
        return { state: 'ready', sessionId: session.id, url: session.url, expiresAt };
    } catch (error) {
        console.error('Unable to finalize Stripe checkout reservation:', error);
        return { state: 'blocked', error: 'Unable to start checkout' };
    }
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

    let reserved = await reserveOrReuseCheckoutSession(admin, userId, userEmail, tier, priceId, successUrl, cancelUrl);
    if (!reserved.ok) {
        return reserved;
    }

    if (reserved.result.action === 'inspect') {
        const { reservationId, sessionId } = reserved.result;
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.status === 'complete') {
                const subscriptionId = typeof session.subscription === 'string'
                    ? session.subscription : session.subscription?.id;
                if (subscriptionId) {
                    const consumed = await adminRpc(admin, 'consume_stripe_checkout', {
                        p_user_id: userId,
                        p_checkout_session_id: sessionId,
                        p_stripe_subscription_id: subscriptionId,
                    });
                    if (consumed.error || consumed.data !== true) {
                        console.error('Unable to consume completed Stripe checkout session:', consumed.error);
                    }
                }
                return { ok: false, status: 500, error: 'Unable to start checkout' };
            }
            if (session.status === 'open') {
                await stripe.checkout.sessions.expire(sessionId);
            } else if (session.status !== 'expired') {
                return { ok: false, status: 500, error: 'Unable to start checkout' };
            }
            const retired = await adminRpc(admin, 'retire_stripe_checkout_session', {
                p_user_id: userId,
                p_reservation_id: reservationId,
                p_checkout_session_id: sessionId,
            });
            if (retired.error || retired.data !== true) {
                return { ok: false, status: 500, error: 'Unable to start checkout' };
            }
            reserved = await reserveOrReuseCheckoutSession(admin, userId, userEmail, tier, priceId, successUrl, cancelUrl);
            if (!reserved.ok) return reserved;
            if (reserved.result.action === 'inspect') {
                return { ok: false, status: 500, error: 'Unable to start checkout' };
            }
        } catch (error) {
            console.error('Unable to inspect Stripe checkout session:', error);
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
    }

    if (reserved.result.action === 'inspect_pending') {
        const old = reserved.result;
        const resolved = await runCheckoutAttempt(admin, userId, old, old, true);
        if (resolved.state !== 'released') {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
        reserved = await reserveOrReuseCheckoutSession(admin, userId, userEmail, tier, priceId, successUrl, cancelUrl);
        if (!reserved.ok) return reserved;
        if (reserved.result.action === 'inspect_pending' || reserved.result.action === 'inspect') {
            return { ok: false, status: 500, error: 'Unable to start checkout' };
        }
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

    const attempt = reserved.result;
    if (attempt.action !== 'create') {
        return { ok: false, status: 500, error: 'Unable to start checkout' };
    }

    const outcome = await runCheckoutAttempt(admin, userId, attempt, {
        userEmail, tier, priceId, successUrl, cancelUrl,
    }, false);
    if (outcome.state !== 'ready') {
        return { ok: false, status: 500, error: outcome.error };
    }
    return {
        ok: true, sessionId: outcome.sessionId, url: outcome.url,
        expiresAt: outcome.expiresAt, reused: false,
    };
}
