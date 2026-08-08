-- Bring production to parity with the `development` branch: the
-- many-to-many video/instructor linkage (table, RLS, indexes, triggers,
-- functions) and the admin role it depends on. Captured via
-- `supabase db diff --linked` against the development branch
-- (hknjeztslvbenmlaqfqa). Ref #23.

-- content_support_admin is used by the new video-instructor RLS policy
-- below but wasn't in the checked-in admin_role vocabulary yet.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_admin_role_check
CHECK (admin_role = ANY (ARRAY['super_admin'::text, 'content_admin'::text, 'support_admin'::text, 'content_support_admin'::text])) NOT VALID;

ALTER TABLE public.profiles
VALIDATE CONSTRAINT profiles_admin_role_check;

CREATE TABLE IF NOT EXISTS public.video_instructors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL,
    instructor_id uuid NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_instructors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'video_instructors_pkey' AND conrelid = 'public.video_instructors'::regclass
    ) THEN
        ALTER TABLE public.video_instructors ADD CONSTRAINT video_instructors_pkey PRIMARY KEY (id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS video_instructors_instructor_id_idx ON public.video_instructors USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS video_instructors_video_id_idx ON public.video_instructors USING btree (video_id);
CREATE UNIQUE INDEX IF NOT EXISTS video_instructors_video_id_instructor_id_key ON public.video_instructors USING btree (video_id, instructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS video_instructors_primary_per_video_idx ON public.video_instructors USING btree (video_id) WHERE (is_primary = true);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'video_instructors_video_id_instructor_id_key' AND conrelid = 'public.video_instructors'::regclass
    ) THEN
        ALTER TABLE public.video_instructors
        ADD CONSTRAINT video_instructors_video_id_instructor_id_key UNIQUE USING INDEX video_instructors_video_id_instructor_id_key;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'video_instructors_instructor_id_fkey' AND conrelid = 'public.video_instructors'::regclass
    ) THEN
        ALTER TABLE public.video_instructors
        ADD CONSTRAINT video_instructors_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'video_instructors_video_id_fkey' AND conrelid = 'public.video_instructors'::regclass
    ) THEN
        ALTER TABLE public.video_instructors
        ADD CONSTRAINT video_instructors_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.video_instructors VALIDATE CONSTRAINT video_instructors_instructor_id_fkey;
ALTER TABLE public.video_instructors VALIDATE CONSTRAINT video_instructors_video_id_fkey;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.video_instructors TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.video_instructors TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.video_instructors TO service_role;

DROP POLICY IF EXISTS "Admins can manage video instructors" ON public.video_instructors;
CREATE POLICY "Admins can manage video instructors"
ON public.video_instructors
AS PERMISSIVE
FOR ALL
TO public
USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.admin_role = ANY (ARRAY['super_admin'::text, 'content_admin'::text, 'content_support_admin'::text])
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.admin_role = ANY (ARRAY['super_admin'::text, 'content_admin'::text, 'content_support_admin'::text])
));

DROP POLICY IF EXISTS "Anyone can view video instructors" ON public.video_instructors;
CREATE POLICY "Anyone can view video instructors"
ON public.video_instructors
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

CREATE OR REPLACE FUNCTION public.get_video_instructor_names(p_video_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(string_agg(DISTINCT i.full_name, ' '), '')
  FROM public.video_instructors vi
  JOIN public.instructors i ON i.id = vi.instructor_id
  WHERE vi.video_id = p_video_id;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_video_fts_from_instructors()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.videos
  SET updated_at = now()
  WHERE instructor_id = NEW.id
     OR id IN (
       SELECT vi.video_id
       FROM public.video_instructors vi
       WHERE vi.instructor_id = NEW.id
     );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_video_fts_from_video_instructors()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  affected_video_id uuid;
BEGIN
  affected_video_id := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE public.videos
  SET updated_at = now()
  WHERE id = affected_video_id;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_video_fts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  instructor_names text := '';
  legacy_name text := '';
BEGIN
  SELECT public.get_video_instructor_names(NEW.id) INTO instructor_names;

  -- Fallback for any legacy rows still relying only on videos.instructor_id.
  IF NEW.instructor_id IS NOT NULL THEN
    SELECT COALESCE(i.full_name, '')
    INTO legacy_name
    FROM public.instructors i
    WHERE i.id = NEW.instructor_id;
  END IF;

  NEW.fts :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', trim(COALESCE(instructor_names, '') || ' ' || COALESCE(legacy_name, ''))), 'C');

  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS instructors_refresh_video_fts_trigger ON public.instructors;
CREATE TRIGGER instructors_refresh_video_fts_trigger AFTER UPDATE OF full_name ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.refresh_video_fts_from_instructors();

DROP TRIGGER IF EXISTS video_instructors_refresh_video_fts_trigger ON public.video_instructors;
CREATE TRIGGER video_instructors_refresh_video_fts_trigger AFTER INSERT OR DELETE OR UPDATE ON public.video_instructors FOR EACH ROW EXECUTE FUNCTION public.refresh_video_fts_from_video_instructors();

DROP TRIGGER IF EXISTS videos_fts_trigger ON public.videos;
CREATE TRIGGER videos_fts_trigger BEFORE INSERT OR UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_video_fts();

-- The legacy single-instructor column never had referential integrity;
-- confirmed missing on production too via direct PostgREST introspection.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'videos_instructor_id_fkey' AND conrelid = 'public.videos'::regclass
    ) THEN
        ALTER TABLE public.videos
        ADD CONSTRAINT videos_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE SET NULL NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.videos VALIDATE CONSTRAINT videos_instructor_id_fkey;
