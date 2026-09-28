-- Single state-machine entry point for every Stripe subscription webhook
-- event (created/updated/deleted/invoice.payment_*).
--
-- REPLAY PROTECTION is a dedicated idempotency table, not a value
-- comparison: stripe_webhook_events(event_id) has a UNIQUE constraint, and
-- every event first does `INSERT ... ON CONFLICT (event_id) DO NOTHING`. If
-- that inserts zero rows, this exact event id was already processed and the
-- call is a no-op success - regardless of what state currently exists. This
-- is what lets the ORDERING guard use plain event_created_at >= (ties
-- allowed) without a replay being able to exploit the tie: a replay is
-- caught here, before the ordering guard ever runs, so it can never
-- "re-win" a same-second race against a distinct event that already
-- superseded it.
--
-- ORDERING is enforced by the Stripe *event's* own created timestamp (not
-- application processing time), stored per subscription row as
-- stripe_event_created_at. A write applies only when not strictly older
-- than what's already recorded:
--   existing.stripe_event_created_at IS NULL
--   OR incoming.event_created_at >= existing.stripe_event_created_at
-- Stripe event timestamps only have second precision, so two distinct
-- events for the same subscription can legitimately share a timestamp;
-- >= (not >) means both still apply, resolving by delivery order for that
-- one second - an accepted tradeoff given Stripe exposes nothing finer.
--
-- IDENTITY: customer.subscription.created/updated/deleted all carry
-- subscription.metadata.userId, so all three go through the same
-- INSERT ... ON CONFLICT (user_id, platform) DO UPDATE upsert (the real
-- UNIQUE constraint). This is what lets an updated/deleted event that
-- arrives *before* its own created event still establish the row (it
-- carries full state) - previously such events were dropped as a no-op,
-- which meant a created event redelivered afterward could stomp a
-- cancellation the created event never knew about.
--
-- The DO UPDATE branch only fires (beyond the ordering guard) when either
-- p_is_creation is true, or the existing row's stripe_subscription_id still
-- matches the incoming event. This is what stops an updated/deleted event
-- for an old, superseded subscription id from ever overwriting a
-- *different*, newer subscription's row (a resubscribe replaces the row via
-- a created event; a stale event for the old id then matches nothing).
--
-- invoice.payment_succeeded/failed carry no user_id, so they go through a
-- separate plain UPDATE matching only by stripe_subscription_id, never
-- insert, never touch tier, and can never move a row out of a terminal
-- status (canceled/incomplete_expired/unpaid) - Stripe does not invoice a
-- deleted subscription, so a late invoice event for one is stale by
-- definition regardless of timestamp.
--
-- Every branch that would change subscription_tier requires a matching
-- profiles row and raises inside the same transaction otherwise, so a
-- missing profile rolls back the entire write (subscription row included).
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id text PRIMARY KEY,
    processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_event_created_at timestamptz;

-- R1 bootstrap: a pre-existing row (written before this migration) has no
-- recorded event time, and a NULL always passes the ordering guard. Stamp
-- every existing row with the deploy time so a genuinely stale event
-- redelivered after deploy (necessarily created before deploy) correctly
-- fails the >= guard instead of unconditionally overwriting legacy state.
UPDATE public.subscriptions
SET stripe_event_created_at = now()
WHERE stripe_event_created_at IS NULL;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
    p_subscription jsonb,
    p_event_created_at timestamptz,
    p_event_id text,
    p_is_creation boolean
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := NULLIF(p_subscription->>'user_id', '')::uuid;
    v_stripe_id text := p_subscription->>'stripe_subscription_id';
    v_tier text := NULLIF(p_subscription->>'tier', '');
    v_status text := p_subscription->>'status';
    v_written_user_id uuid;
    v_is_terminal boolean := v_status IN ('canceled', 'incomplete_expired', 'unpaid');
    v_dedup_id text;
BEGIN
    IF v_stripe_id IS NULL OR v_stripe_id = '' OR p_event_created_at IS NULL OR p_event_id IS NULL THEN
        RETURN false;
    END IF;

    INSERT INTO public.stripe_webhook_events (event_id)
    VALUES (p_event_id)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id INTO v_dedup_id;

    IF v_dedup_id IS NULL THEN
        RETURN true; -- exact replay of an already-processed event: no-op success
    END IF;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (
            user_id, platform, external_subscription_id, tier, status,
            stripe_subscription_id, stripe_customer_id, current_period_start,
            current_period_end, cancel_at_period_end, canceled_at, updated_at,
            stripe_event_created_at
        ) VALUES (
            v_user_id,
            'stripe',
            COALESCE(p_subscription->>'external_subscription_id', v_stripe_id),
            COALESCE(v_tier, 'none'),
            v_status,
            v_stripe_id,
            p_subscription->>'stripe_customer_id',
            (p_subscription->>'current_period_start')::timestamptz,
            (p_subscription->>'current_period_end')::timestamptz,
            COALESCE((p_subscription->>'cancel_at_period_end')::boolean, false),
            (p_subscription->>'canceled_at')::timestamptz,
            COALESCE((p_subscription->>'updated_at')::timestamptz, now()),
            p_event_created_at
        )
        ON CONFLICT (user_id, platform) DO UPDATE SET
            external_subscription_id = EXCLUDED.external_subscription_id,
            tier = EXCLUDED.tier,
            status = EXCLUDED.status,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
            -- deleted events don't reliably carry period timestamps; keep
            -- the existing value rather than nulling it out.
            current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
            current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            canceled_at = EXCLUDED.canceled_at,
            updated_at = EXCLUDED.updated_at,
            stripe_event_created_at = EXCLUDED.stripe_event_created_at
        WHERE (subscriptions.stripe_event_created_at IS NULL
               OR EXCLUDED.stripe_event_created_at >= subscriptions.stripe_event_created_at)
          AND (p_is_creation OR subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id)
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            RETURN false; -- stale, or a non-creation event for a superseded subscription id
        END IF;

        UPDATE public.profiles
        SET subscription_tier = CASE WHEN v_is_terminal THEN NULL ELSE COALESCE(v_tier, subscription_tier) END
        WHERE id = v_written_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Profile missing for Stripe subscription %', v_stripe_id;
        END IF;

        RETURN true;
    END IF;

    -- Invoice events: no user_id in the payload, so only touch an existing
    -- row for this exact Stripe subscription id; never insert, never touch
    -- tier, never revive a terminal row.
    UPDATE public.subscriptions
    SET
        status = v_status,
        updated_at = COALESCE((p_subscription->>'updated_at')::timestamptz, now()),
        stripe_event_created_at = p_event_created_at
    WHERE stripe_subscription_id = v_stripe_id
      AND (stripe_event_created_at IS NULL OR p_event_created_at >= stripe_event_created_at)
      AND status NOT IN ('canceled', 'incomplete_expired', 'unpaid')
    RETURNING user_id INTO v_written_user_id;

    RETURN v_written_user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.record_stripe_subscription_created(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_state(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, boolean);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, timestamptz, text);
