-- Add many-to-many video/instructor relationships and keep video search in sync.

BEGIN;

CREATE TABLE IF NOT EXISTS public.video_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS video_instructors_video_id_idx
  ON public.video_instructors (video_id);

CREATE INDEX IF NOT EXISTS video_instructors_instructor_id_idx
  ON public.video_instructors (instructor_id);

CREATE UNIQUE INDEX IF NOT EXISTS video_instructors_primary_per_video_idx
  ON public.video_instructors (video_id)
  WHERE is_primary = true;

-- Backfill link table from legacy videos.instructor_id values.
INSERT INTO public.video_instructors (video_id, instructor_id, is_primary)
SELECT v.id, v.instructor_id, true
FROM public.videos v
WHERE v.instructor_id IS NOT NULL
ON CONFLICT (video_id, instructor_id) DO NOTHING;

ALTER TABLE public.video_instructors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view video instructors" ON public.video_instructors;
CREATE POLICY "Anyone can view video instructors"
  ON public.video_instructors
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage video instructors" ON public.video_instructors;
CREATE POLICY "Admins can manage video instructors"
  ON public.video_instructors
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.admin_role IN ('super_admin', 'content_admin', 'content_support_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.admin_role IN ('super_admin', 'content_admin', 'content_support_admin')
    )
  );

GRANT ALL ON TABLE public.video_instructors TO anon;
GRANT ALL ON TABLE public.video_instructors TO authenticated;
GRANT ALL ON TABLE public.video_instructors TO service_role;

CREATE OR REPLACE FUNCTION public.get_video_instructor_names(p_video_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(string_agg(DISTINCT i.full_name, ' '), '')
  FROM public.video_instructors vi
  JOIN public.instructors i ON i.id = vi.instructor_id
  WHERE vi.video_id = p_video_id;
$$;

CREATE OR REPLACE FUNCTION public.update_video_fts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS videos_fts_trigger ON public.videos;
CREATE TRIGGER videos_fts_trigger
  BEFORE INSERT OR UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_fts();

CREATE OR REPLACE FUNCTION public.refresh_video_fts_from_video_instructors()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_video_id uuid;
BEGIN
  affected_video_id := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE public.videos
  SET updated_at = now()
  WHERE id = affected_video_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS video_instructors_refresh_video_fts_trigger ON public.video_instructors;
CREATE TRIGGER video_instructors_refresh_video_fts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.video_instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_video_fts_from_video_instructors();

CREATE OR REPLACE FUNCTION public.refresh_video_fts_from_instructors()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS instructors_refresh_video_fts_trigger ON public.instructors;
CREATE TRIGGER instructors_refresh_video_fts_trigger
  AFTER UPDATE OF full_name ON public.instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_video_fts_from_instructors();

-- One-time refresh after trigger/function updates.
UPDATE public.videos
SET updated_at = now();

COMMIT;
