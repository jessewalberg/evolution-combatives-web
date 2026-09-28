-- Checkout reservation (one in-flight Stripe Checkout per user) and monotonic
-- webhook writes keyed by Stripe event.created (not fetch time).

CREATE TABLE IF NOT EXISTS public.stripe_checkout_reservations (
    user_id uuid PRIMARY KEY,
    reservation_id uuid NOT NULL UNIQUE,
    tier text NOT NULL,
    request_fingerprint text NOT NULL,
    checkout_session_id text,
    checkout_session_url text,
    expires_at timestamptz,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stripe_checkout_reservations_status_check
        CHECK (status IN ('pending', 'ready', 'completed', 'released'))
);

CREATE UNIQUE INDEX stripe_checkout_reservations_session_id_key
    ON public.stripe_checkout_reservations (checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;

ALTER TABLE public.stripe_checkout_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_checkout_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_checkout_reservations TO service_role;

CREATE TABLE IF NOT EXISTS public.stripe_checkout_sessions (
    checkout_session_id text PRIMARY KEY,
    user_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    stripe_subscription_id text,
    expires_at timestamptz NOT NULL,
    reconciled_at timestamptz,
    status text NOT NULL CHECK (status IN ('ready', 'completed', 'expired'))
);

ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_checkout_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_checkout_sessions TO service_role;

CREATE TABLE IF NOT EXISTS public.stripe_orphan_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    existing_stripe_subscription_id text NOT NULL,
    event_id text NOT NULL,
    needs_refund boolean NOT NULL DEFAULT false,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE UNIQUE INDEX stripe_orphan_subscriptions_stripe_id_key
    ON public.stripe_orphan_subscriptions (stripe_subscription_id);

ALTER TABLE public.stripe_orphan_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_orphan_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_orphan_subscriptions TO service_role;

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_last_event_created_at timestamptz;

UPDATE public.subscriptions
SET stripe_created_at = created_at
WHERE platform = 'stripe' AND stripe_created_at IS NULL;

CREATE OR REPLACE FUNCTION public.reserve_stripe_checkout(
    p_user_id uuid,
    p_tier text,
    p_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_row public.stripe_checkout_reservations%ROWTYPE;
    v_live_count integer;
    v_reservation_id uuid;
BEGIN
    IF p_user_id IS NULL OR p_tier IS NULL OR p_tier = ''
       OR p_request_fingerprint IS NULL OR p_request_fingerprint = '' THEN
        RETURN jsonb_build_object('error', 'invalid_request');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || p_user_id::text));

    SELECT count(*)::integer INTO v_live_count
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status NOT IN ('canceled', 'incomplete_expired', 'unpaid');

    IF v_live_count > 1 THEN
        RETURN jsonb_build_object('error', 'ambiguous_subscription_state');
    ELSIF v_live_count = 1 THEN
        RETURN jsonb_build_object('error', 'subscription_in_progress');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.stripe_orphan_subscriptions
        WHERE user_id = p_user_id
          AND needs_refund
          AND resolved_at IS NULL
    ) THEN
        RETURN jsonb_build_object('error', 'unresolved_payment');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.stripe_checkout_sessions cs
        WHERE cs.user_id = p_user_id AND cs.status = 'completed'
          AND cs.reconciled_at IS NULL
    ) THEN
        RETURN jsonb_build_object('error', 'checkout_in_progress');
    END IF;

    SELECT * INTO v_row
    FROM public.stripe_checkout_reservations
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF FOUND AND v_row.status = 'ready' THEN
        IF v_row.checkout_session_id IS NULL OR v_row.expires_at IS NULL THEN
            RETURN jsonb_build_object('error', 'checkout_in_progress');
        END IF;
        IF v_row.expires_at <= now() THEN
            RETURN jsonb_build_object(
                'action', 'inspect',
                'reservation_id', v_row.reservation_id,
                'session_id', v_row.checkout_session_id
            );
        END IF;
        IF v_row.tier = p_tier AND v_row.request_fingerprint = p_request_fingerprint THEN
            RETURN jsonb_build_object(
                'action', 'reuse',
                'reservation_id', v_row.reservation_id,
                'session_id', v_row.checkout_session_id,
                'url', v_row.checkout_session_url,
                'expires_at', v_row.expires_at
            );
        END IF;
        RETURN jsonb_build_object('error', 'checkout_in_progress');
    END IF;

    IF FOUND
       AND v_row.status = 'pending'
       AND v_row.updated_at > now() - interval '10 minutes' THEN
        RETURN jsonb_build_object('error', 'checkout_in_progress');
    END IF;

    v_reservation_id := gen_random_uuid();

    INSERT INTO public.stripe_checkout_reservations (
        user_id, reservation_id, tier, request_fingerprint, checkout_session_id,
        checkout_session_url, expires_at, status, updated_at
    ) VALUES (
        p_user_id, v_reservation_id, p_tier, p_request_fingerprint, NULL, NULL, NULL, 'pending', now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        reservation_id = EXCLUDED.reservation_id,
        tier = EXCLUDED.tier,
        request_fingerprint = EXCLUDED.request_fingerprint,
        checkout_session_id = NULL,
        checkout_session_url = NULL,
        expires_at = NULL,
        status = 'pending',
        updated_at = now();

    RETURN jsonb_build_object(
        'action', 'create',
        'reservation_id', v_reservation_id,
        'idempotency_key', 'checkout:' || v_reservation_id::text
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_stripe_checkout_reservation(
    p_user_id uuid,
    p_reservation_id uuid,
    p_checkout_session_id text,
    p_checkout_session_url text,
    p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || p_user_id::text));

    UPDATE public.stripe_checkout_reservations
    SET checkout_session_id = p_checkout_session_id,
        checkout_session_url = p_checkout_session_url,
        expires_at = p_expires_at,
        status = 'ready',
        updated_at = now()
    WHERE user_id = p_user_id
      AND reservation_id = p_reservation_id
      AND status = 'pending';
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    INSERT INTO public.stripe_checkout_sessions (
        checkout_session_id, user_id, reservation_id, expires_at, status
    ) VALUES (p_checkout_session_id, p_user_id, p_reservation_id, p_expires_at, 'ready');
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_stripe_checkout(
    p_user_id uuid,
    p_checkout_session_id text,
    p_stripe_subscription_id text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_session public.stripe_checkout_sessions%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR NULLIF(p_checkout_session_id, '') IS NULL
       OR NULLIF(p_stripe_subscription_id, '') IS NULL THEN
        RETURN false;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || p_user_id::text));

    SELECT * INTO v_session
    FROM public.stripe_checkout_sessions
    WHERE checkout_session_id = p_checkout_session_id
    FOR UPDATE;
    IF NOT FOUND OR v_session.user_id <> p_user_id THEN
        RETURN false;
    END IF;
    IF v_session.status = 'completed' THEN
        RETURN v_session.stripe_subscription_id = p_stripe_subscription_id;
    END IF;
    IF v_session.status <> 'ready' THEN
        RETURN false;
    END IF;

    UPDATE public.stripe_checkout_sessions
    SET status = 'completed', stripe_subscription_id = p_stripe_subscription_id,
        reconciled_at = CASE WHEN EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = p_user_id AND s.platform = 'stripe'
              AND s.stripe_subscription_id = p_stripe_subscription_id
        ) OR EXISTS (
            SELECT 1 FROM public.stripe_orphan_subscriptions o
            WHERE o.user_id = p_user_id AND o.stripe_subscription_id = p_stripe_subscription_id
        ) THEN now() ELSE NULL END
    WHERE checkout_session_id = p_checkout_session_id;

    UPDATE public.stripe_checkout_reservations
    SET status = 'completed',
        checkout_session_url = NULL,
        updated_at = now()
    WHERE user_id = p_user_id
      AND checkout_session_id = p_checkout_session_id
      AND status = 'ready'
      AND reservation_id = v_session.reservation_id;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stripe_checkout_reservation(
    p_user_id uuid,
    p_reservation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || p_user_id::text));

    UPDATE public.stripe_checkout_reservations
    SET status = 'released',
        checkout_session_id = NULL,
        checkout_session_url = NULL,
        expires_at = NULL,
        updated_at = now()
    WHERE user_id = p_user_id
      AND reservation_id = p_reservation_id
      AND status = 'pending' AND checkout_session_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_stripe_checkout_session(
    p_user_id uuid,
    p_reservation_id uuid,
    p_checkout_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || p_user_id::text));

    UPDATE public.stripe_checkout_reservations
    SET status = 'released', checkout_session_id = NULL,
        checkout_session_url = NULL, expires_at = NULL, updated_at = now()
    WHERE user_id = p_user_id AND reservation_id = p_reservation_id
      AND checkout_session_id = p_checkout_session_id AND status = 'ready';
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE public.stripe_checkout_sessions
    SET status = 'expired'
    WHERE user_id = p_user_id AND reservation_id = p_reservation_id
      AND checkout_session_id = p_checkout_session_id AND status = 'ready';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Checkout session ledger missing for %', p_checkout_session_id;
    END IF;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_stripe_checkout(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_checkout(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_stripe_checkout_reservation(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_stripe_checkout_reservation(uuid, uuid, text, text, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.consume_stripe_checkout(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_stripe_checkout(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.release_stripe_checkout_reservation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stripe_checkout_reservation(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.retire_stripe_checkout_session(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retire_stripe_checkout_session(uuid, uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, text);

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
    p_subscription jsonb,
    p_event_id text,
    p_event_created_at bigint,
    p_payment_succeeded boolean
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := NULLIF(p_subscription->>'user_id', '')::uuid;
    v_stripe_id text := p_subscription->>'stripe_subscription_id';
    v_stripe_created_at timestamptz := (p_subscription->>'stripe_created_at')::timestamptz;
    v_event_created_at timestamptz := CASE
        WHEN p_event_created_at IS NULL THEN NULL
        ELSE to_timestamp(p_event_created_at)
    END;
    v_tier text := NULLIF(p_subscription->>'tier', '');
    v_status text := p_subscription->>'status';
    v_written_user_id uuid;
    v_is_terminal boolean := v_status IN ('canceled', 'incomplete_expired', 'unpaid');
    v_dedup_id text;
    v_existing public.subscriptions%ROWTYPE;
BEGIN
    IF v_user_id IS NULL OR v_stripe_id IS NULL OR v_stripe_id = ''
       OR v_stripe_created_at IS NULL OR p_event_id IS NULL OR v_event_created_at IS NULL THEN
        RETURN false;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('stripe_checkout:' || v_user_id::text));

    INSERT INTO public.stripe_webhook_events (event_id)
    VALUES (p_event_id)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id INTO v_dedup_id;

    IF v_dedup_id IS NULL THEN
        RETURN true;
    END IF;

    SELECT * INTO v_existing
    FROM public.subscriptions
    WHERE user_id = v_user_id AND platform = 'stripe'
    FOR UPDATE;

    IF FOUND
       AND v_existing.stripe_subscription_id IS DISTINCT FROM v_stripe_id
       AND v_existing.status NOT IN ('canceled', 'incomplete_expired', 'unpaid') THEN
        INSERT INTO public.stripe_orphan_subscriptions (
            user_id,
            stripe_subscription_id,
            existing_stripe_subscription_id,
            event_id,
            needs_refund,
            payload
        ) VALUES (
            v_user_id,
            v_stripe_id,
            v_existing.stripe_subscription_id,
            p_event_id,
            p_payment_succeeded IS TRUE
                AND v_existing.stripe_created_at IS NOT NULL
                AND v_event_created_at >= v_existing.stripe_created_at,
            p_subscription
        ) ON CONFLICT (stripe_subscription_id) DO UPDATE SET
            needs_refund = stripe_orphan_subscriptions.needs_refund OR EXCLUDED.needs_refund,
            event_id = CASE WHEN EXCLUDED.needs_refund THEN EXCLUDED.event_id ELSE stripe_orphan_subscriptions.event_id END,
            payload = CASE WHEN EXCLUDED.needs_refund THEN EXCLUDED.payload ELSE stripe_orphan_subscriptions.payload END,
            resolved_at = CASE WHEN EXCLUDED.needs_refund THEN NULL ELSE stripe_orphan_subscriptions.resolved_at END;

        UPDATE public.stripe_checkout_sessions
        SET reconciled_at = now()
        WHERE user_id = v_user_id AND stripe_subscription_id = v_stripe_id
          AND status = 'completed' AND reconciled_at IS NULL;
        RETURN true;
    END IF;

    INSERT INTO public.subscriptions (
        user_id, platform, external_subscription_id, tier, status,
        stripe_subscription_id, stripe_created_at, stripe_last_event_created_at,
        stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
    ) VALUES (
        v_user_id,
        'stripe',
        COALESCE(p_subscription->>'external_subscription_id', v_stripe_id),
        COALESCE(v_tier, 'none'),
        v_status,
        v_stripe_id,
        v_stripe_created_at,
        v_event_created_at,
        p_subscription->>'stripe_customer_id',
        (p_subscription->>'current_period_start')::timestamptz,
        (p_subscription->>'current_period_end')::timestamptz,
        COALESCE((p_subscription->>'cancel_at_period_end')::boolean, false),
        (p_subscription->>'canceled_at')::timestamptz,
        now()
    )
    ON CONFLICT (user_id, platform) DO UPDATE SET
        external_subscription_id = EXCLUDED.external_subscription_id,
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_created_at = EXCLUDED.stripe_created_at,
        stripe_last_event_created_at = EXCLUDED.stripe_last_event_created_at,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = EXCLUDED.updated_at
    WHERE (
        subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
        AND (
            subscriptions.stripe_last_event_created_at IS NULL
            OR EXCLUDED.stripe_last_event_created_at > subscriptions.stripe_last_event_created_at
            OR (
                EXCLUDED.stripe_last_event_created_at = subscriptions.stripe_last_event_created_at
                AND (
                    subscriptions.status NOT IN ('canceled', 'incomplete_expired', 'unpaid')
                    OR EXCLUDED.status IN ('canceled', 'incomplete_expired', 'unpaid')
                )
            )
        )
    ) OR (
        subscriptions.stripe_subscription_id IS DISTINCT FROM EXCLUDED.stripe_subscription_id
        AND subscriptions.status IN ('canceled', 'incomplete_expired', 'unpaid')
        AND (
            subscriptions.stripe_created_at IS NULL
            OR subscriptions.stripe_created_at < EXCLUDED.stripe_created_at
        )
    )
    RETURNING user_id INTO v_written_user_id;

    IF v_written_user_id IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.profiles
    SET subscription_tier = CASE WHEN v_is_terminal THEN NULL ELSE COALESCE(v_tier, subscription_tier) END
    WHERE id = v_written_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile missing for Stripe subscription %', v_stripe_id;
    END IF;

    UPDATE public.stripe_checkout_sessions
    SET reconciled_at = now()
    WHERE user_id = v_user_id AND stripe_subscription_id = v_stripe_id
      AND status = 'completed' AND reconciled_at IS NULL;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, text, bigint, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, text, bigint, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, text, bigint, boolean) TO service_role;
