CREATE OR REPLACE FUNCTION public.record_stripe_subscription_created(p_subscription jsonb)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := (p_subscription->>'user_id')::uuid;
    v_stripe_id text := p_subscription->>'stripe_subscription_id';
    inserted_user_id uuid;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE stripe_subscription_id = v_stripe_id
    ) THEN
        RETURN false;
    END IF;

    DELETE FROM public.subscriptions
    WHERE user_id = v_user_id
      AND platform = 'stripe'
      AND stripe_subscription_id IS DISTINCT FROM v_stripe_id
      AND status IN ('canceled', 'incomplete_expired', 'unpaid');

    INSERT INTO public.subscriptions (
        user_id, platform, external_subscription_id, tier, status,
        stripe_subscription_id, stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
    ) VALUES (
        v_user_id,
        'stripe',
        p_subscription->>'external_subscription_id',
        p_subscription->>'tier',
        p_subscription->>'status',
        v_stripe_id,
        p_subscription->>'stripe_customer_id',
        (p_subscription->>'current_period_start')::timestamptz,
        (p_subscription->>'current_period_end')::timestamptz,
        (p_subscription->>'cancel_at_period_end')::boolean,
        (p_subscription->>'canceled_at')::timestamptz,
        (p_subscription->>'updated_at')::timestamptz
    )
    RETURNING user_id INTO inserted_user_id;

    UPDATE public.profiles
    SET subscription_tier = p_subscription->>'tier'
    WHERE id = inserted_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile missing for Stripe subscription %', v_stripe_id;
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_state(p_subscription jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_stripe_id text := p_subscription->>'stripe_subscription_id';
    v_user_id uuid;
    v_tier text;
BEGIN
    IF v_stripe_id IS NULL OR v_stripe_id = '' THEN
        RETURN;
    END IF;

    v_user_id := NULLIF(p_subscription->>'user_id', '')::uuid;
    v_tier := NULLIF(p_subscription->>'tier', '');

    INSERT INTO public.subscriptions (
        user_id, platform, external_subscription_id, tier, status,
        stripe_subscription_id, stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
    ) VALUES (
        v_user_id,
        'stripe',
        COALESCE(p_subscription->>'external_subscription_id', v_stripe_id),
        COALESCE(v_tier, 'none'),
        p_subscription->>'status',
        v_stripe_id,
        p_subscription->>'stripe_customer_id',
        (p_subscription->>'current_period_start')::timestamptz,
        (p_subscription->>'current_period_end')::timestamptz,
        COALESCE((p_subscription->>'cancel_at_period_end')::boolean, false),
        (p_subscription->>'canceled_at')::timestamptz,
        COALESCE((p_subscription->>'updated_at')::timestamptz, now())
    )
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        tier = COALESCE(EXCLUDED.tier, subscriptions.tier),
        status = EXCLUDED.status,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
        current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = EXCLUDED.updated_at;

    IF (p_subscription->>'status') IN ('canceled', 'incomplete_expired', 'unpaid') THEN
        SELECT user_id INTO v_user_id
        FROM public.subscriptions
        WHERE stripe_subscription_id = v_stripe_id;

        IF v_user_id IS NOT NULL THEN
            UPDATE public.profiles
            SET subscription_tier = NULL
            WHERE id = v_user_id;
        END IF;
    ELSIF v_tier IS NOT NULL AND (p_subscription->>'status') = 'active' THEN
        SELECT user_id INTO v_user_id
        FROM public.subscriptions
        WHERE stripe_subscription_id = v_stripe_id;

        IF v_user_id IS NOT NULL THEN
            UPDATE public.profiles
            SET subscription_tier = v_tier
            WHERE id = v_user_id;
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_stripe_subscription_created(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_stripe_subscription_created(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_subscription_created(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.apply_stripe_subscription_state(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_state(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_state(jsonb) TO service_role;
