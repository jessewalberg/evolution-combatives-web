-- Capture `bookmarks`, which exists in production with real data but was
-- never captured in a checked-in migration (see #23). Reconstructed via
-- `supabase db diff --linked` against the production project
-- (bxpxpkiubjbcmgsnfpvp), so this reflects the actual live DDL: RLS
-- policies, indexes, and cascade behavior included.

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT bookmarks_user_id_video_id_key UNIQUE (user_id, video_id)
);

COMMENT ON COLUMN public.bookmarks.notes IS 'Optional user notes about why they saved this video';

CREATE INDEX bookmarks_created_at_idx ON public.bookmarks USING btree (created_at DESC);
CREATE INDEX bookmarks_user_id_idx ON public.bookmarks USING btree (user_id);
CREATE INDEX bookmarks_video_id_idx ON public.bookmarks USING btree (video_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
ON public.bookmarks
FOR SELECT
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks"
ON public.bookmarks
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks"
ON public.bookmarks
FOR UPDATE
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
ON public.bookmarks
FOR DELETE
TO public
USING (auth.uid() = user_id);
