-- Migration: Add Bookmarks/Saved Videos Table
-- Allows users to save videos for later viewing

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    notes text, -- Optional notes the user can add
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Ensure a user can only bookmark a video once
    UNIQUE(user_id, video_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS bookmarks_video_id_idx ON bookmarks(video_id);
CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx ON bookmarks(created_at DESC);

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own bookmarks
CREATE POLICY "Users can view their own bookmarks"
    ON bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks"
    ON bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
    ON bookmarks FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookmarks"
    ON bookmarks FOR UPDATE
    USING (auth.uid() = user_id);

COMMENT ON TABLE bookmarks IS 'User saved/bookmarked videos for later viewing';
COMMENT ON COLUMN bookmarks.notes IS 'Optional user notes about why they saved this video';
