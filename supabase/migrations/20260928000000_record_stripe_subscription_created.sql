-- Single state-machine entry point for every Stripe subscription webhook
-- event (created/updated/deleted/invoice.payment_*).
--
-- REPLAY SHORT-CIRCUIT: stripe_webhook_events(event_id) is still a dedup
-- table, kept purely as an efficiency guard (skip a redundant Stripe API
-- fetch + write on an exact event replay) - not for correctness, since a
-- replay's fetch-fresh write would be a harmless no-op anyway.
--
-- Every write that changes subscription_tier requires a matching profiles
-- row and raises inside the same transaction otherwise, so a missing
-- profile rolls back the entire write (subscription row included).
--
-- ACCEPTED RESIDUAL RACE: the "fetch, then write" step is not atomic across
-- the JS call and this RPC. If two *different* Stripe events for the same
-- subscription id are handled concurrently (for example a `created` and a
-- later `updated` webhook delivered close together), each does its own
-- stripe.subscriptions.retrieve() before either calls this RPC, and the two
-- writes can land out of order - the older fetch's write can commit last,
-- leaving stale status/period data until the next webhook or a client
-- retry corrects it. Closing this fully needs a lock that spans the
-- Stripe API round trip and the DB write (e.g. a distributed lock keyed by
-- subscription id), which a pooled/serverless Postgres connection over
-- PostgREST likely can't provide via a plain session-level advisory lock
-- across two separate RPC calls. Given how narrow the window is (both
-- events must be in flight within the same few hundred milliseconds) this
-- is accepted as a known limitation rather than built out here.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id text PRIMARY KEY,
    processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

-- Superseded by fetch-fresh-from-API: no event-time ordering is compared
-- anymore, so there is nothing to store per row.
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_event_created_at;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_event_id;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_created_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
    p_subscription jsonb,
    p_event_id text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := NULLIF(p_subscription->>'user_id', '')::uuid;
    v_stripe_id text := p_subscription->>'stripe_subscription_id';
    v_stripe_created_at timestamptz := (p_subscription->>'stripe_created_at')::timestamptz;
    v_tier text := NULLIF(p_subscription->>'tier', '');
    v_status text := p_subscription->>'status';
    v_written_user_id uuid;
    v_is_terminal boolean := v_status IN ('canceled', 'incomplete_expired', 'unpaid');
    v_dedup_id text;
BEGIN
    IF v_user_id IS NULL OR v_stripe_id IS NULL OR v_stripe_id = ''
       OR v_stripe_created_at IS NULL OR p_event_id IS NULL THEN
        RETURN false;
    END IF;

    INSERT INTO public.stripe_webhook_events (event_id)
    VALUES (p_event_id)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id INTO v_dedup_id;

    IF v_dedup_id IS NULL THEN
        RETURN true; -- exact replay of an already-processed event: no-op success
    END IF;

    INSERT INTO public.subscriptions (
        user_id, platform, external_subscription_id, tier, status,
        stripe_subscription_id, stripe_created_at, stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
    ) VALUES (
        v_user_id,
        'stripe',
        COALESCE(p_subscription->>'external_subscription_id', v_stripe_id),
        COALESCE(v_tier, 'none'),
        v_status,
        v_stripe_id,
        v_stripe_created_at,
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
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = EXCLUDED.updated_at
    WHERE subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
       OR (subscriptions.status IN ('canceled', 'incomplete_expired', 'unpaid')
           AND (subscriptions.stripe_created_at IS NULL
                OR subscriptions.stripe_created_at < EXCLUDED.stripe_created_at))
    RETURNING user_id INTO v_written_user_id;

    IF v_written_user_id IS NULL THEN
        RETURN false; -- a different, still-live subscription occupies the row
    END IF;

    UPDATE public.profiles
    SET subscription_tier = CASE WHEN v_is_terminal THEN NULL ELSE COALESCE(v_tier, subscription_tier) END
    WHERE id = v_written_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile missing for Stripe subscription %', v_stripe_id;
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, text) TO service_role;

DROP FUNCTION IF EXISTS public.record_stripe_subscription_created(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_state(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, boolean);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, timestamptz, text);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean);
