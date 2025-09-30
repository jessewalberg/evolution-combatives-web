-- Migration: Add missing columns to disciplines table
-- Adds all missing columns to match TypeScript schema
-- 
-- Evolution Combatives - Database Migration
-- Date: December 2024

-- Check current disciplines table structure first
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'disciplines' 
ORDER BY ordinal_position;

-- Add slug column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN slug TEXT;
        
        -- Generate slugs from existing names
        UPDATE disciplines 
        SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'))
        WHERE slug IS NULL;
        
        -- Make slug NOT NULL after populating
        ALTER TABLE disciplines ALTER COLUMN slug SET NOT NULL;
        
        COMMENT ON COLUMN disciplines.slug IS 'URL-friendly slug for the discipline';
    END IF;
END $$;

-- Add color column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'color'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN color TEXT 
        DEFAULT '#3B82F6';
        
        COMMENT ON COLUMN disciplines.color IS 'Hex color code for the discipline theme';
    END IF;
END $$;

-- Add icon column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN icon TEXT;
        
        COMMENT ON COLUMN disciplines.icon IS 'Icon identifier for the discipline';
    END IF;
END $$;

-- Add subscription_tier_required column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'subscription_tier_required'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN subscription_tier_required TEXT 
        CHECK (subscription_tier_required IN ('none', 'tier1', 'tier2', 'tier3'))
        DEFAULT 'none';
        
        COMMENT ON COLUMN disciplines.subscription_tier_required IS 'Subscription tier required to access this discipline content';
    END IF;
END $$;

-- Add sort_order column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN sort_order INTEGER 
        DEFAULT 1;
        
        -- Set sort order based on creation order
        WITH ordered_disciplines AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
            FROM disciplines
        )
        UPDATE disciplines 
        SET sort_order = od.rn
        FROM ordered_disciplines od
        WHERE disciplines.id = od.id;
        
        COMMENT ON COLUMN disciplines.sort_order IS 'Display order for the discipline';
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN is_active BOOLEAN 
        DEFAULT true;
        
        COMMENT ON COLUMN disciplines.is_active IS 'Whether this discipline is active and visible to users';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'disciplines' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE disciplines 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE 
        DEFAULT NOW();
        
        COMMENT ON COLUMN disciplines.updated_at IS 'Timestamp when the discipline was last updated';
    END IF;
END $$;

-- Update existing disciplines to have default values for all new columns
UPDATE disciplines 
SET 
    slug = COALESCE(slug, LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'))),
    color = COALESCE(color, '#3B82F6'),
    subscription_tier_required = COALESCE(subscription_tier_required, 'none'),
    sort_order = COALESCE(sort_order, 1),
    is_active = COALESCE(is_active, true),
    updated_at = COALESCE(updated_at, NOW())
WHERE 
    slug IS NULL 
    OR color IS NULL
    OR subscription_tier_required IS NULL 
    OR sort_order IS NULL
    OR is_active IS NULL
    OR updated_at IS NULL;

-- Verify the changes - show all columns
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'disciplines' 
ORDER BY ordinal_position;

-- Show current disciplines with all columns
SELECT 
    id,
    name,
    slug,
    description,
    color,
    icon,
    subscription_tier_required,
    sort_order,
    is_active,
    created_at,
    updated_at
FROM disciplines 
ORDER BY sort_order;
