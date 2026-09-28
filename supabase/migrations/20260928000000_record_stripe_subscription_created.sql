-- Single state-machine entry point for every Stripe subscription webhook
-- event (created/updated/deleted/invoice.payment_*). Design notes:
--
-- Ordering is enforced by the Stripe *event's* own created timestamp and id
-- (not application processing time, and not event type), stored per row as
-- stripe_event_created_at / stripe_event_id. A write is applied only when
-- the incoming event is not older than what is already recorded:
--
--   existing.stripe_event_created_at IS NULL
--   OR incoming.event_created_at > existing.stripe_event_created_at
--   OR (incoming.event_created_at = existing.stripe_event_created_at
--       AND incoming.event_id = existing.stripe_event_id)   -- exact replay
--
-- This single guard, uniform across every event type, is what makes the
-- function correct under:
--   * replay of an already-applied event (same event id + timestamp -
--     reapplies identical data, a safe no-op)
--   * a stale event redelivered after newer events already landed (guard
--     fails, write skipped - a canceled row can never be reopened by a
--     late-arriving created/updated/invoice event for an older lifecycle)
--   * resubscribe (a later created event for a new Stripe subscription id
--     always carries a newer event timestamp than the prior cancellation,
--     so the guard passes regardless of the row's current status - no
--     separate "terminal status" special case is needed)
--   * out-of-order delivery (an update/delete that arrives before its
--     matching created event finds no row with a user_id match yet if
--     p_user_id is null and no existing row has this stripe_subscription_id
--     - skipped as a no-op; the later created event is authoritative)
--
-- The row is addressed by (user_id, platform) - the real UNIQUE constraint -
-- when p_user_id is available (created/updated/deleted all carry
-- subscription.metadata.userId). Invoice events only know the Stripe
-- subscription id, not the user, so they pass p_user_id = NULL and instead
-- match an existing row by stripe_subscription_id; they never insert a new
-- row and never change subscription_tier (invoices don't carry tier data).
--
-- Every branch that would change subscription_tier requires a matching
-- profiles row and raises inside the same transaction otherwise, so a
-- missing profile rolls back the entire write (subscription row included).
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_event_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_event_id text;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
    p_subscription jsonb,
    p_event_created_at timestamptz,
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
BEGIN
    IF v_stripe_id IS NULL OR v_stripe_id = '' OR p_event_created_at IS NULL THEN
        RETURN false;
    END IF;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (
            user_id, platform, external_subscription_id, tier, status,
            stripe_subscription_id, stripe_customer_id, current_period_start,
            current_period_end, cancel_at_period_end, canceled_at, updated_at,
            stripe_event_created_at, stripe_event_id
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
            p_event_created_at,
            p_event_id
        )
        ON CONFLICT (user_id, platform) DO UPDATE SET
            external_subscription_id = EXCLUDED.external_subscription_id,
            tier = EXCLUDED.tier,
            status = EXCLUDED.status,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            canceled_at = EXCLUDED.canceled_at,
            updated_at = EXCLUDED.updated_at,
            stripe_event_created_at = EXCLUDED.stripe_event_created_at,
            stripe_event_id = EXCLUDED.stripe_event_id
        WHERE subscriptions.stripe_event_created_at IS NULL
           OR EXCLUDED.stripe_event_created_at > subscriptions.stripe_event_created_at
           OR (EXCLUDED.stripe_event_created_at = subscriptions.stripe_event_created_at
               AND EXCLUDED.stripe_event_id = subscriptions.stripe_event_id)
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            RETURN false; -- stale event: a newer event already landed
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
    -- row for this exact Stripe subscription id, and never change tier.
    UPDATE public.subscriptions
    SET
        status = v_status,
        updated_at = COALESCE((p_subscription->>'updated_at')::timestamptz, now()),
        stripe_event_created_at = p_event_created_at,
        stripe_event_id = p_event_id
    WHERE stripe_subscription_id = v_stripe_id
      AND (stripe_event_created_at IS NULL
           OR p_event_created_at > stripe_event_created_at
           OR (p_event_created_at = stripe_event_created_at AND p_event_id = stripe_event_id))
    RETURNING user_id INTO v_written_user_id;

    RETURN v_written_user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text) TO service_role;

DROP FUNCTION IF EXISTS public.record_stripe_subscription_created(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_state(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, boolean);
