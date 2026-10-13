-- manual_tier is a comp grant, stored apart from the Stripe tier.
--
-- protect_profile_admin_role in 20260807000000 fires only for admin_role.
-- "Users can update own profile" would otherwise let a member set manual_tier
-- and pass the paid-video check. The column is added in 20261012000000, so
-- this trigger has to follow that migration. Super admins, the service role,
-- postgres, and supabase_admin may change it.

CREATE OR REPLACE FUNCTION public.protect_profile_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.admin_role IS DISTINCT FROM OLD.admin_role
        AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
        AND NOT public.current_user_has_admin_role(ARRAY['super_admin']) THEN
        RAISE EXCEPTION 'Only super admins can change admin roles'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.manual_tier IS DISTINCT FROM OLD.manual_tier
        AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
        AND NOT public.current_user_has_admin_role(ARRAY['super_admin']) THEN
        RAISE EXCEPTION 'Only super admins can change manual tier'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_admin_role() FROM PUBLIC;
-- The trigger runs as the updating role, which must be allowed to execute it.
-- A direct call still fails: PostgreSQL only runs a trigger function as a trigger.
GRANT EXECUTE ON FUNCTION public.protect_profile_admin_role() TO authenticated, service_role;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
BEFORE UPDATE OF admin_role, manual_tier ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_admin_role();
