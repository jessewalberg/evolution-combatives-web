-- Single state-machine entry point for all Stripe subscription webhook
-- events (created/updated/deleted). Design notes (review R1/R2/R3):
--
-- The subscriptions table enforces UNIQUE (user_id, platform), so a user has
-- at most one Stripe subscription row ever. That row is upserted here keyed
-- by (user_id, platform) rather than by stripe_subscription_id, which lets
-- one statement handle replay, resubscribe, and out-of-order delivery
-- without a separate DELETE (no more delete-then-insert race - R1):
--
--   * p_is_creation = true (customer.subscription.created): the WHERE guard
--     on ON CONFLICT DO UPDATE only fires when the existing row is either
--     the *same* Stripe subscription (idempotent replay - safe to reapply)
--     or in a terminal state (canceled/incomplete_expired/unpaid - a
--     resubscribe with a new Stripe ID is allowed to replace it). A created
--     event for a still-active *different* subscription id is silently
--     skipped (extremely unlikely given create-checkout.ts blocks new
--     checkouts while an active subscription exists).
--   * p_is_creation = false (updated/deleted): only a row whose
--     stripe_subscription_id still matches the incoming event is touched.
--     Once a resubscribe has overwritten the row with a new Stripe ID, a
--     stale updated/deleted event for the superseded ID matches no row and
--     is a no-op - it can never resurrect canceled state (R3). An
--     updated/deleted event that arrives before its matching created event
--     likewise matches no row yet and is a no-op; the later created event
--     is authoritative for establishing the row.
--
-- Both branches require a matching profiles row before mutating
-- subscription_tier and raise inside the same transaction otherwise, so a
-- missing profile rolls back the whole write (R2) - true for the initial
-- creation and for every subsequent update/deletion.
CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(p_subscription jsonb, p_is_creation boolean)
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
    IF v_stripe_id IS NULL OR v_stripe_id = '' THEN
        RETURN false;
    END IF;

    IF p_is_creation THEN
        IF v_user_id IS NULL THEN
            RETURN false;
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
            COALESCE((p_subscription->>'updated_at')::timestamptz, now())
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
            updated_at = EXCLUDED.updated_at
        WHERE subscriptions.stripe_subscription_id = EXCLUDED.stripe_subscription_id
           OR subscriptions.status IN ('canceled', 'incomplete_expired', 'unpaid')
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            -- Existing row is a different, still-active subscription; the
            -- create is out of scope for this state machine (skip, not an
            -- error - checkout already guards this in the normal path).
            RETURN false;
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
            updated_at = COALESCE((p_subscription->>'updated_at')::timestamptz, now())
        WHERE stripe_subscription_id = v_stripe_id
        RETURNING user_id INTO v_written_user_id;

        IF v_written_user_id IS NULL THEN
            -- No row for this Stripe id: either it arrived before the
            -- created event, or a resubscribe already superseded it.
            -- Either way there is nothing safe to mutate.
            RETURN false;
        END IF;
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

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(jsonb, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(jsonb, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.record_stripe_subscription_created(jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscription_state(jsonb);
