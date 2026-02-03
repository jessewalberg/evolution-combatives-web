-- Add file_size column to videos for storing original file size (bytes)
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS file_size BIGINT;

COMMENT ON COLUMN public.videos.file_size IS 'Original uploaded file size in bytes';
