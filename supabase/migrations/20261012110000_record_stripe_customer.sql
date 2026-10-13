CREATE OR REPLACE FUNCTION public.record_stripe_customer(
    p_customer_id text,
    p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_customer_id IS NULL OR pg_catalog.btrim(p_customer_id) = '' OR p_user_id IS NULL THEN
        RETURN jsonb_build_object('result', 'conflict');
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_id, 0));

    IF EXISTS (
        SELECT 1
        FROM public.stripe_customers
        WHERE stripe_customer_id = p_customer_id AND user_id <> p_user_id
    ) THEN
        RETURN jsonb_build_object('result', 'conflict');
    END IF;

    INSERT INTO public.stripe_customers (stripe_customer_id, user_id)
    VALUES (p_customer_id, p_user_id)
    ON CONFLICT (stripe_customer_id, user_id) DO NOTHING;

    RETURN jsonb_build_object('result', 'recorded');
END;
$$;

REVOKE ALL ON FUNCTION public.record_stripe_customer(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_customer(text, uuid) TO service_role;
