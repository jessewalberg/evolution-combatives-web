-- Single state-machine entry point for every Stripe subscription webhook
-- event (created/updated/deleted/invoice.payment_*). Design notes:
--
-- Ordering is enforced by the Stripe *event's* own created timestamp and id
-- (not application processing time), stored per row as
-- stripe_event_created_at / stripe_event_id. A write is applied only when
-- the incoming event is not strictly older than what is already recorded:
--
--   existing.stripe_event_created_at IS NULL
--   OR incoming.event_created_at >= existing.stripe_event_created_at
--
-- Stripe event timestamps only have second precision, so two distinct
-- events for the same subscription can legitimately share a timestamp;
-- using >= (not >) means a same-second event is still applied rather than
-- silently dropped, at the cost of same-second events resolving by
-- delivery order instead of a further tiebreaker - an acceptable tradeoff
-- since Stripe does not expose anything finer than the second for this.
--
-- p_is_creation distinguishes "this event can establish or replace the
-- Stripe subscription for this user" (customer.subscription.created) from "this
-- event can only advance the *current* subscription lifecycle"
-- (customer.subscription.updated/deleted, invoice.payment_*):
--   * p_is_creation = true: upserts keyed by (user_id, platform) - the real
--     UNIQUE constraint - so a later created event (subject to the ordering
--     guard) always wins over a prior subscription's row regardless of its
--     Stripe id or status. This is what makes resubscribe work from *any*
--     prior state, not just terminal ones.
--   * p_is_creation = false: only mutates a row whose *current*
--     stripe_subscription_id still matches the incoming event. Once a
--     resubscribe has replaced the row with a new Stripe id, a
--     later-arriving updated/deleted/invoice event for the superseded id
--     matches no row and is a no-op - it can never hijack the new
--     subscription's row (regression from an earlier round: matching by
--     user_id alone let a stale event for an old Stripe id overwrite a
--     newer, different subscription).
--
-- Invoice events (p_is_creation = false, p_user_id = NULL - they carry no
-- subscription.metadata) additionally never move a row out of a terminal
-- status (canceled/incomplete_expired/unpaid): Stripe does not invoice a
-- genuinely deleted subscription, so a late invoice event for one is
-- necessarily stale relative to its cancellation even when the ordering
-- guard alone could not tell (e.g. a same-second tie) - this guard is a
-- second, independent safety net for that case. Invoice events also never
-- set tier or insert a new row; they only update status.
--
-- Every branch that changes subscription_tier requires a matching profiles
-- row and raises inside the same transaction otherwise, so a missing
-- profile rolls back the entire write (subscription row included).
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_event_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_event_id text;

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
BEGIN
    IF v_stripe_id IS NULL OR v_stripe_id = '' OR p_event_created_at IS NULL THEN
        RETURN false;
    END IF;

    IF p_is_creation THEN
        IF v_user_id IS NULL THEN
            RETURN false;
        END IF;

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
           OR EXCLUDED.stripe_event_created_at >= subscriptions.stripe_event_created_at
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            RETURN false; -- stale created event: a newer event already landed
        END IF;
    ELSE
        UPDATE public.subscriptions
        SET
            tier = COALESCE(v_tier, tier),
            status = v_status,
            cancel_at_period_end = COALESCE((p_subscription->>'cancel_at_period_end')::boolean, cancel_at_period_end),
            canceled_at = COALESCE((p_subscription->>'canceled_at')::timestamptz, canceled_at),
            current_period_start = COALESCE((p_subscription->>'current_period_start')::timestamptz, current_period_start),
            current_period_end = COALESCE((p_subscription->>'current_period_end')::timestamptz, current_period_end),
            updated_at = COALESCE((p_subscription->>'updated_at')::timestamptz, now()),
            stripe_event_created_at = p_event_created_at,
            stripe_event_id = p_event_id
        WHERE stripe_subscription_id = v_stripe_id
          AND (stripe_event_created_at IS NULL OR p_event_created_at >= stripe_event_created_at)
          -- invoice events (v_user_id NULL) can never revive a terminal row
          AND (v_user_id IS NOT NULL OR status NOT IN ('canceled', 'incomplete_expired', 'unpaid'))
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            RETURN false; -- out of order, superseded id, stale, or terminal row (invoices only)
        END IF;
    END IF;

    -- Invoice events never carry tier metadata; leave subscription_tier untouched.
    IF v_user_id IS NULL THEN
        RETURN true;
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

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, timestamptz, text, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.record_stripe_subscription_created(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_state(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, boolean);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_event(jsonb, timestamptz, text);
</content>
