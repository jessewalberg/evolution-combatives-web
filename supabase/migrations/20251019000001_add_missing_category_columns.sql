-- =====================================================
-- Add missing columns to categories table
-- =====================================================
-- The categories table was missing several columns that disciplines has
-- This migration adds them to match the expected schema

-- Add slug column (URL-friendly identifier)
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS slug text;

-- Add color column (hex color code)
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6B7280';

-- Add icon column (icon identifier)
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS icon text;

-- Add subscription_tier_required column
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS subscription_tier_required text DEFAULT 'none'
CHECK (subscription_tier_required IN ('none', 'tier1', 'tier2', 'tier3'));

-- Add is_active column
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add updated_at column
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add comments for documentation
COMMENT ON COLUMN public.categories.slug IS 'URL-friendly slug for the category';
COMMENT ON COLUMN public.categories.color IS 'Hex color code for the category theme';
COMMENT ON COLUMN public.categories.icon IS 'Icon identifier for the category';
COMMENT ON COLUMN public.categories.subscription_tier_required IS 'Subscription tier required to access this category content';
COMMENT ON COLUMN public.categories.is_active IS 'Whether this category is active and visible to users';
COMMENT ON COLUMN public.categories.updated_at IS 'Timestamp when the category was last updated';

-- Backfill slug for existing categories (generate from name)
UPDATE public.categories
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE public.categories
ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint on slug within each discipline
CREATE UNIQUE INDEX IF NOT EXISTS categories_discipline_slug_unique 
ON public.categories(discipline_id, slug);

-- =====================================================
-- Output results
-- =====================================================
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'categories'
ORDER BY ordinal_position;

