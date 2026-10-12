-- Atomic Stripe entitlement write.
--
-- One transaction locks the member profile, refuses a stripe_subscription_id
-- owned by someone else, upserts the (user_id, platform) row, and updates
-- profiles.stripe_reconcile_version and subscription_tier together from the
-- Stripe snapshot the caller just fetched. Event timestamps are stored for
-- audit and do not decide whether that snapshot is written. Requires
-- 20260808000003 (stripe columns and the unique stripe_subscription_id index)
-- and subscriptions_user_id_platform_key.

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_event_id text,
    ADD COLUMN IF NOT EXISTS stripe_event_created bigint,
    ADD COLUMN IF NOT EXISTS stripe_subscription_created bigint;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_reconcile_version bigint NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS manual_tier text NOT NULL DEFAULT 'none'
    CONSTRAINT profiles_manual_tier_check CHECK (manual_tier IN ('none', 'tier1', 'tier2', 'tier3'));

-- Preserve existing profile grants that are not explained by an active Stripe row.
UPDATE public.profiles AS p
SET manual_tier = p.subscription_tier
WHERE p.subscription_tier IN ('tier1', 'tier2', 'tier3')
  AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions AS s
      WHERE s.user_id = p.id AND s.platform = 'stripe'
        AND s.status IN ('active', 'trialing')
        AND CASE s.tier WHEN 'tier3' THEN 3 WHEN 'tier2' THEN 2 WHEN 'tier1' THEN 1 ELSE 0 END
            >= CASE p.subscription_tier WHEN 'tier3' THEN 3 WHEN 'tier2' THEN 2 ELSE 1 END
  );

CREATE TABLE IF NOT EXISTS public.stripe_customers (
    stripe_customer_id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.stripe_customers TO service_role;

INSERT INTO public.stripe_customers (stripe_customer_id, user_id)
SELECT DISTINCT stripe_customer_id, user_id
FROM public.subscriptions
WHERE stripe_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_stripe_entitlement(
    p_user_id uuid,
    p_expected_version bigint,
    p_event_id text,
    p_event_created bigint,
    p_stripe_subscription_id text,
    p_stripe_customer_id text,
    p_customer_ids text[],
    p_subscription_created bigint,
    p_tier text,
    p_status text,
    p_current_period_start timestamptz,
    p_current_period_end timestamptz,
    p_cancel_at_period_end boolean,
    p_canceled_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_version bigint;
    v_owner uuid;
    v_platform text;
    v_row public.subscriptions%ROWTYPE;
    v_customer_id text;
BEGIN
    IF p_tier NOT IN ('none', 'tier1', 'tier2', 'tier3') THEN
        RAISE EXCEPTION 'invalid subscription tier';
    END IF;

    IF p_status NOT IN (
        'active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'paused'
    ) THEN
        RAISE EXCEPTION 'invalid subscription status';
    END IF;

    SELECT stripe_reconcile_version
    INTO v_version
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('result', 'missing_profile');
    END IF;

    IF p_expected_version IS DISTINCT FROM v_version THEN
        RETURN jsonb_build_object('result', 'retry', 'version', v_version);
    END IF;

    FOREACH v_customer_id IN ARRAY p_customer_ids LOOP
        IF v_customer_id IS NOT NULL AND v_customer_id <> '' THEN
            SELECT user_id INTO v_owner
            FROM public.stripe_customers
            WHERE stripe_customer_id = v_customer_id;
            IF FOUND AND v_owner IS DISTINCT FROM p_user_id THEN
                RETURN jsonb_build_object('result', 'ownership_conflict', 'version', v_version);
            END IF;
        END IF;
    END LOOP;

    SELECT user_id, platform
    INTO v_owner, v_platform
    FROM public.subscriptions
    WHERE stripe_subscription_id = p_stripe_subscription_id
    FOR UPDATE;

    IF FOUND AND (v_owner IS DISTINCT FROM p_user_id OR v_platform IS DISTINCT FROM 'stripe') THEN
        RETURN jsonb_build_object('result', 'ownership_conflict', 'version', v_version);
    END IF;

    SELECT *
    INTO v_row
    FROM public.subscriptions
    WHERE user_id = p_user_id AND platform = 'stripe'
    FOR UPDATE;

    IF v_row.id IS NOT NULL THEN
        IF v_row.stripe_event_id = p_event_id THEN
            RETURN jsonb_build_object('result', 'duplicate', 'version', v_version);
        END IF;

        -- The snapshot was just read from Stripe. Apply it even when this
        -- event is older than the one stored: a newer cancellation can be
        -- indexed before the paid subscription Stripe search omitted.
    END IF;

    INSERT INTO public.stripe_customers (stripe_customer_id, user_id)
    SELECT DISTINCT customer_id, p_user_id
    FROM unnest(p_customer_ids) AS customer_id
    WHERE customer_id IS NOT NULL AND customer_id <> ''
    ON CONFLICT (stripe_customer_id) DO NOTHING;

    IF EXISTS (
        SELECT 1 FROM public.stripe_customers
        WHERE stripe_customer_id = ANY(p_customer_ids) AND user_id <> p_user_id
    ) THEN
        RAISE unique_violation;
    END IF;

    IF v_row.id IS NULL THEN
        INSERT INTO public.subscriptions (
            user_id,
            platform,
            external_subscription_id,
            status,
            tier,
            stripe_subscription_id,
            stripe_customer_id,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            canceled_at,
            updated_at,
            stripe_event_id,
            stripe_event_created,
            stripe_subscription_created
        ) VALUES (
            p_user_id,
            'stripe',
            p_stripe_subscription_id,
            p_status,
            p_tier,
            p_stripe_subscription_id,
            p_stripe_customer_id,
            p_current_period_start,
            p_current_period_end,
            p_cancel_at_period_end,
            p_canceled_at,
            pg_catalog.now(),
            p_event_id,
            p_event_created,
            p_subscription_created
        );
    ELSE
        UPDATE public.subscriptions
        SET external_subscription_id = p_stripe_subscription_id,
            status = p_status,
            tier = p_tier,
            stripe_subscription_id = p_stripe_subscription_id,
            stripe_customer_id = p_stripe_customer_id,
            current_period_start = p_current_period_start,
            current_period_end = p_current_period_end,
            cancel_at_period_end = p_cancel_at_period_end,
            canceled_at = p_canceled_at,
            updated_at = pg_catalog.now(),
            stripe_event_id = p_event_id,
            stripe_event_created = p_event_created,
            stripe_subscription_created = p_subscription_created
        WHERE id = v_row.id;
    END IF;

    UPDATE public.profiles
    SET stripe_reconcile_version = stripe_reconcile_version + 1,
        subscription_tier = CASE GREATEST(
            CASE manual_tier WHEN 'tier3' THEN 3 WHEN 'tier2' THEN 2 WHEN 'tier1' THEN 1 ELSE 0 END,
            CASE WHEN p_status IN ('active', 'trialing') THEN
                CASE p_tier WHEN 'tier3' THEN 3 WHEN 'tier2' THEN 2 WHEN 'tier1' THEN 1 ELSE 0 END
            ELSE 0 END
        ) WHEN 3 THEN 'tier3' WHEN 2 THEN 'tier2' WHEN 1 THEN 'tier1' ELSE 'none' END,
        updated_at = pg_catalog.now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('result', 'applied', 'version', v_version + 1);
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('result', 'retry');
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_stripe_entitlement(
    uuid, bigint, text, bigint, text, text, text[], bigint, text, text, timestamptz, timestamptz, boolean, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_stripe_entitlement(
    uuid, bigint, text, bigint, text, text, text[], bigint, text, text, timestamptz, timestamptz, boolean, timestamptz
) TO service_role;
