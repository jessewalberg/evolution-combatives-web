-- Reconcile checked-in migrations with production (bxpxpkiubjbcmgsnfpvp),
-- captured via `supabase db diff --linked` (see #23). None of this is new
-- behavior -- it documents what production already runs.

-- The checked-in profiles_subscription_tier_check still lists the old
-- ('basic', 'professional', 'lifetime') vocabulary. Production enforces
-- ('none', 'tier1', 'tier2', 'tier3') -- the values the app and the
-- disciplines.subscription_tier_required check actually use. A fresh
-- environment built from the old constraint would reject every tier value
-- the app writes.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_subscription_tier_check
CHECK (subscription_tier = ANY (ARRAY['none'::text, 'tier1'::text, 'tier2'::text, 'tier3'::text])) NOT VALID;

ALTER TABLE public.profiles
VALIDATE CONSTRAINT profiles_subscription_tier_check;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS phone text;

-- user_progress in production was never watched_seconds/last_watched --
-- it's always been progress_seconds/progress_percentage/last_watched_at/
-- completion_date. The checked-in remote_schema.sql captured columns that
-- don't exist live.
ALTER TABLE public.user_progress
DROP COLUMN IF EXISTS last_watched,
DROP COLUMN IF EXISTS watched_seconds,
ADD COLUMN IF NOT EXISTS completion_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_watched_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS progress_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_seconds integer DEFAULT 0;

-- Full-text search on videos, keyed off title/description/instructor name.
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS fts tsvector;

CREATE INDEX IF NOT EXISTS videos_fts_idx ON public.videos USING gin (fts);
CREATE INDEX IF NOT EXISTS videos_instructor_id_idx ON public.videos USING btree (instructor_id);

CREATE OR REPLACE FUNCTION public.get_video_instructor_name(p_instructor_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(full_name, '') FROM instructors WHERE id = p_instructor_id;
$$;

CREATE OR REPLACE FUNCTION public.videos_fts_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    instructor_name text;
BEGIN
    -- Get instructor name
    SELECT COALESCE(full_name, '') INTO instructor_name 
    FROM instructors 
    WHERE id = NEW.instructor_id;
    
    -- Build the weighted search vector
    NEW.fts := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(instructor_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
    
    RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS videos_fts_update_trigger ON public.videos;
CREATE TRIGGER videos_fts_update_trigger
BEFORE INSERT OR UPDATE OF title, description, instructor_id ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.videos_fts_update();

-- Full-text search on instructors, keyed off name/bio.
ALTER TABLE public.instructors
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, COALESCE(full_name, ''::text)), 'A'::"char") ||
    setweight(to_tsvector('english'::regconfig, COALESCE(bio, ''::text)), 'B'::"char")
) STORED;

CREATE INDEX IF NOT EXISTS instructors_fts_idx ON public.instructors USING gin (fts);

-- Only one active/trialing subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_unique
ON public.subscriptions USING btree (user_id)
WHERE (status = ANY (ARRAY['active'::text, 'trialing'::text]));
