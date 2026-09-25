-- Protect authorization and entitlement fields from self-service profile
-- updates. RLS chooses rows; a trigger is required to compare OLD and NEW.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    -- Trusted backend/database roles maintain these fields for billing and
    -- administrative workflows.
    IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    -- No authenticated user may promote themselves or grant themselves a paid
    -- entitlement, including a super admin changing their own row.
    IF auth.uid() = OLD.id
       AND (
           NEW.admin_role IS DISTINCT FROM OLD.admin_role
           OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       ) THEN
        RAISE EXCEPTION 'Users cannot change their own role or subscription tier'
            USING ERRCODE = '42501';
    END IF;

    -- Only a super admin can change privileged fields for another profile.
    IF (
        NEW.admin_role IS DISTINCT FROM OLD.admin_role
        OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
    ) AND NOT public.current_user_has_admin_role(ARRAY['super_admin']) THEN
        RAISE EXCEPTION 'Only super admins can change profile privileges'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
-- Run after every update so the comparison also sees changes made by any
-- current or future BEFORE trigger, not only columns named in the client SET.
CREATE TRIGGER protect_profile_privileged_fields
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Keep ordinary self-service profile updates while requiring an unchanged row
-- identity. The trigger above protects the two privileged columns.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Profile and subscription administration uses an explicit role vocabulary.
DROP POLICY IF EXISTS "Admins can view profiles" ON public.profiles;
CREATE POLICY "Admins can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.current_user_has_admin_role(ARRAY['super_admin']))
WITH CHECK (public.current_user_has_admin_role(ARRAY['super_admin']));

DROP POLICY IF EXISTS "Admins can view subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin', 'content_support_admin']
    )
);

-- Hybrid content/support admins have users.read in the application and need the
-- same read-only progress visibility as the two specialist admin roles.
DROP POLICY IF EXISTS "Admins can view user progress" ON public.user_progress;
CREATE POLICY "Admins can view user progress"
ON public.user_progress
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin', 'content_support_admin']
    )
);

-- Replace the original "admin_role IS NOT NULL" content policies with exact
-- content-management roles.
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage disciplines" ON public.disciplines;
CREATE POLICY "Admins can manage disciplines"
ON public.disciplines
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage instructors" ON public.instructors;
CREATE POLICY "Admins can manage instructors"
ON public.instructors
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage videos" ON public.videos;
CREATE POLICY "Admins can manage videos"
ON public.videos
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage video instructors" ON public.video_instructors;
CREATE POLICY "Admins can manage video instructors"
ON public.video_instructors
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'content_support_admin']
    )
);

-- Audit history is append-only through the authenticated API. The only app
-- writer records the current admin's own activity; service_role remains the
-- trusted backend path for system-generated entries. No UPDATE or DELETE
-- policy is created.
DROP POLICY IF EXISTS "Admin access only" ON public.admin_activity;
DROP POLICY IF EXISTS "Super admins can view admin activity" ON public.admin_activity;
DROP POLICY IF EXISTS "Admins can append own activity" ON public.admin_activity;
CREATE POLICY "Super admins can view admin activity"
ON public.admin_activity
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(ARRAY['super_admin'])
);

CREATE POLICY "Admins can append own activity"
ON public.admin_activity
FOR INSERT
TO authenticated
WITH CHECK (
    admin_id = auth.uid()
    AND
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin', 'content_support_admin']
    )
);

-- The original policy was named as a read policy but used the default FOR ALL,
-- which also let a user mark their own question answered, change priority, or
-- rewrite vote totals. Preserve ownership-scoped CRUD for question content and
-- protect row identity plus moderation-owned fields with a comparison trigger.
CREATE OR REPLACE FUNCTION public.protect_question_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           NEW.id IS DISTINCT FROM OLD.id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
       ) THEN
        RAISE EXCEPTION 'Question identity fields cannot be changed'
            USING ERRCODE = '42501';
    END IF;

    IF auth.uid() IS NOT NULL THEN
        IF public.current_user_has_admin_role(
            ARRAY['super_admin', 'support_admin', 'content_support_admin']
        ) THEN
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS DISTINCT FROM NEW.user_id
           OR NEW.status IS DISTINCT FROM 'pending'
           OR COALESCE(NEW.answered, false) IS DISTINCT FROM false
           OR NEW.priority IS DISTINCT FROM 'medium'
           OR COALESCE(NEW.upvotes, 0) <> 0 THEN
            RAISE EXCEPTION 'Users may only create pending questions for themselves'
                USING ERRCODE = '42501';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status
          OR NEW.answered IS DISTINCT FROM OLD.answered
          OR NEW.priority IS DISTINCT FROM OLD.priority
          OR NEW.upvotes IS DISTINCT FROM OLD.upvotes THEN
        RAISE EXCEPTION 'Only question moderators can change moderation fields'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_question_moderation_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_question_moderation_fields ON public.questions;
CREATE TRIGGER protect_question_moderation_fields
AFTER INSERT OR UPDATE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.protect_question_moderation_fields();

DROP POLICY IF EXISTS "Users can view own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can create own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can update own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can delete own questions" ON public.questions;

CREATE POLICY "Users can view own questions"
ON public.questions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own questions"
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND COALESCE(answered, false) = false
    AND priority = 'medium'
    AND COALESCE(upvotes, 0) = 0
);

CREATE POLICY "Users can update own questions"
ON public.questions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions"
ON public.questions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'support_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'support_admin', 'content_support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage answers" ON public.answers;
CREATE POLICY "Admins can manage answers"
ON public.answers
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'support_admin', 'content_support_admin']
    )
)
WITH CHECK (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'support_admin', 'content_support_admin']
    )
);
