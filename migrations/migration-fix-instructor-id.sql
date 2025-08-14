-- Migration to fix instructor_id constraint issue
-- Create instructors table and add instructor_id column to videos table

-- Create instructors table
CREATE TABLE IF NOT EXISTS instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    specialties TEXT[],
    years_experience INTEGER,
    credentials TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add instructor_id column to videos table (nullable, no foreign key constraint for now)
ALTER TABLE videos ADD COLUMN instructor_id UUID;

-- Verify the change
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name = 'instructor_id';