-- Align the database schema with the existing admin dashboard queries.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS badge_number text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS rank text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'closed')),
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS video_timestamp integer,
ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS tags text[];

UPDATE public.questions
SET
    title = COALESCE(NULLIF(title, ''), LEFT(question, 120)),
    content = COALESCE(NULLIF(content, ''), question),
    status = CASE WHEN answered THEN 'answered' ELSE status END,
    updated_at = COALESCE(updated_at, created_at);

ALTER TABLE public.questions
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN content SET NOT NULL;

ALTER TABLE public.answers
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.answers
SET
    content = COALESCE(NULLIF(content, ''), answer),
    updated_at = COALESCE(updated_at, created_at);

ALTER TABLE public.answers
ALTER COLUMN content SET NOT NULL;

-- Keep the old mobile fields and the new admin fields compatible.
CREATE OR REPLACE FUNCTION public.sync_question_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.question := COALESCE(NULLIF(NEW.question, ''), NEW.content);
    NEW.content := COALESCE(NULLIF(NEW.content, ''), NEW.question);
    NEW.title := COALESCE(NULLIF(NEW.title, ''), LEFT(NEW.content, 120));
    NEW.answered := COALESCE(NEW.answered, false);

    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.answered := NEW.status = 'answered';
    ELSIF TG_OP = 'UPDATE' AND NEW.answered IS DISTINCT FROM OLD.answered THEN
        NEW.status := CASE WHEN NEW.answered THEN 'answered' ELSE 'pending' END;
    ELSIF NEW.answered THEN
        NEW.status := 'answered';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_question_compatibility ON public.questions;
CREATE TRIGGER sync_question_compatibility
BEFORE INSERT OR UPDATE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.sync_question_compatibility();

CREATE OR REPLACE FUNCTION public.sync_answer_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.answer := COALESCE(NULLIF(NEW.answer, ''), NEW.content);
    NEW.content := COALESCE(NULLIF(NEW.content, ''), NEW.answer);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_answer_compatibility ON public.answers;
CREATE TRIGGER sync_answer_compatibility
BEFORE INSERT OR UPDATE ON public.answers
FOR EACH ROW
EXECUTE FUNCTION public.sync_answer_compatibility();

-- Add public-schema foreign keys for PostgREST relationship queries.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'questions_user_profile_id_fkey'
          AND conrelid = 'public.questions'::regclass
    ) THEN
        ALTER TABLE public.questions
        ADD CONSTRAINT questions_user_profile_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'answers_admin_profile_id_fkey'
          AND conrelid = 'public.answers'::regclass
    ) THEN
        ALTER TABLE public.answers
        ADD CONSTRAINT answers_admin_profile_id_fkey
        FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE NOT VALID;
    END IF;
END;
$$;

-- Use security-definer functions to avoid recursive profile policies.
CREATE OR REPLACE FUNCTION public.current_user_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT admin_role
    FROM public.profiles
    WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_admin_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(public.current_user_admin_role() = ANY(allowed_roles), false);
$$;

REVOKE ALL ON FUNCTION public.current_user_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_admin_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_admin_role(text[]) TO authenticated;

-- RLS cannot compare OLD and NEW values. Use a trigger to protect admin roles.
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

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_admin_role() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_profile_admin_role ON public.profiles;
CREATE TRIGGER protect_profile_admin_role
BEFORE UPDATE OF admin_role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_admin_role();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view profiles" ON public.profiles;
CREATE POLICY "Admins can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin']
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
        ARRAY['super_admin', 'content_admin', 'support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can view user progress" ON public.user_progress;
CREATE POLICY "Admins can view user progress"
ON public.user_progress
FOR SELECT
TO authenticated
USING (
    public.current_user_has_admin_role(
        ARRAY['super_admin', 'content_admin', 'support_admin']
    )
);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(ARRAY['super_admin', 'support_admin'])
)
WITH CHECK (
    public.current_user_has_admin_role(ARRAY['super_admin', 'support_admin'])
);

DROP POLICY IF EXISTS "Admins can manage answers" ON public.answers;
CREATE POLICY "Admins can manage answers"
ON public.answers
FOR ALL
TO authenticated
USING (
    public.current_user_has_admin_role(ARRAY['super_admin', 'support_admin'])
)
WITH CHECK (
    public.current_user_has_admin_role(ARRAY['super_admin', 'support_admin'])
);
