-- Ensure legacy videos.instructor_id remains consistent when instructors are deleted.

BEGIN;

-- Clean up any orphaned legacy references before adding FK.
UPDATE public.videos v
SET instructor_id = NULL
WHERE v.instructor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.instructors i
    WHERE i.id = v.instructor_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'videos_instructor_id_fkey'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_instructor_id_fkey
      FOREIGN KEY (instructor_id)
      REFERENCES public.instructors(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

