-- Single state-machine entry point for every Stripe subscription webhook
-- event (created/updated/deleted/invoice.payment_*).
--
-- DESIGN: Stripe's own guidance is that webhook delivery order is not
-- guaranteed, and recommends not trusting an event's payload as a
-- point-in-time snapshot to reconcile against local state - instead,
-- refetch the object's *current* state from the API when handling any
-- event for it. src/server/webhooks/stripe.ts follows this: every handler
-- calls stripe.subscriptions.retrieve() for the referenced subscription id
-- and passes that live object here, not the event payload. That is what
-- eliminates the entire class of timestamp/ordering bugs earlier versions
-- of this migration tried (and failed) to solve with an event-time
-- ordering guard: there is no "staleness" to compare, because every call
-- writes the subscription's actual current truth. Two events for the same
-- id processed in any order converge on the identical value once both
-- fetch (whichever the fetch was, both processed after the true current
-- one exists); a replay writes the same current truth again (harmless).
--
-- REPLAY SHORT-CIRCUIT: stripe_webhook_events(event_id) is still a dedup
-- table, kept purely as an efficiency guard (skip a redundant Stripe API
-- fetch + write on an exact event replay) - not for correctness, since a
-- replay's fetch-fresh write would be a harmless no-op anyway.
--
-- IDENTITY: every event type here (created/updated/deleted/invoice.*) now
-- carries the *subscription's own current metadata.userId and tier* (they
-- all go through the same "fetch the subscription, read its metadata"
-- path in stripe.ts), so they all use the identical upsert keyed by
-- (user_id, platform) - the real UNIQUE constraint. The DO UPDATE branch
-- only fires when either the existing row already belongs to this same
-- Stripe subscription id, or the existing row is in a terminal status
-- (canceled/incomplete_expired/unpaid). This is what lets a resubscribe
-- (a new Stripe subscription id) take over the row once the old one has
-- genuinely ended, while stopping a write for a *different*, still-live
-- subscription from ever clobbering it - our own checkout
-- (create-checkout.ts) blocks starting a second checkout while any
-- non-terminal subscription exists, so in practice this guard is never
-- exercised by two live subscriptions racing for the same row; it remains
-- as defense in depth against an out-of-band Stripe-side subscription.
--
-- Every write that changes subscription_tier requires a matching profiles
-- row and raises inside the same transaction otherwise, so a missing
-- profile rolls back the entire write (subscription row included).
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
    v_tier text := NULLIF(p_subscription->>'tier', '');
    v_status text := p_subscription->>'status';
    v_written_user_id uuid;
    v_is_terminal boolean := v_status IN ('canceled', 'incomplete_expired', 'unpaid');
    v_dedup_id text;
BEGIN
    IF v_user_id IS NULL OR v_stripe_id IS NULL OR v_stripe_id = '' OR p_event_id IS NULL THEN
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
        stripe_subscription_id, stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
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
        now()
    )
    ON CONFLICT (user_id, platform) DO UPDATE SET
        external_subscription_id = EXCLUDED.external_subscription_id,
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = EXCLUDED.updated_at
    WHERE subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
       OR subscriptions.status IN ('canceled', 'incomplete_expired', 'unpaid')
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
