CREATE FUNCTION public.record_stripe_subscription_created(p_subscription jsonb)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    inserted_user_id uuid;
BEGIN
    INSERT INTO public.subscriptions (
        user_id, platform, external_subscription_id, tier, status,
        stripe_subscription_id, stripe_customer_id, current_period_start,
        current_period_end, cancel_at_period_end, canceled_at, updated_at
    ) VALUES (
        (p_subscription->>'user_id')::uuid,
        'stripe',
        p_subscription->>'external_subscription_id',
        p_subscription->>'tier',
        p_subscription->>'status',
        p_subscription->>'stripe_subscription_id',
        p_subscription->>'stripe_customer_id',
        (p_subscription->>'current_period_start')::timestamptz,
        (p_subscription->>'current_period_end')::timestamptz,
        (p_subscription->>'cancel_at_period_end')::boolean,
        (p_subscription->>'canceled_at')::timestamptz,
        (p_subscription->>'updated_at')::timestamptz
    )
    ON CONFLICT (stripe_subscription_id) DO NOTHING
    RETURNING user_id INTO inserted_user_id;

    IF inserted_user_id IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.profiles
    SET subscription_tier = p_subscription->>'tier'
    WHERE id = inserted_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile missing for Stripe subscription %', p_subscription->>'stripe_subscription_id';
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_stripe_subscription_created(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_stripe_subscription_created(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_subscription_created(jsonb) TO service_role;
