-- Fix profiles subscription_tier constraint to use tier1/tier2/tier3
-- instead of basic/professional/lifetime

-- First, update any existing values to the new format
UPDATE public.profiles 
SET subscription_tier = 'tier1' 
WHERE subscription_tier = 'basic';

UPDATE public.profiles 
SET subscription_tier = 'tier2' 
WHERE subscription_tier = 'professional';

UPDATE public.profiles 
SET subscription_tier = 'tier3' 
WHERE subscription_tier = 'lifetime';

-- Drop the old constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

-- Add new constraint with tier1/tier2/tier3 values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier = ANY (ARRAY['none'::text, 'tier1'::text, 'tier2'::text, 'tier3'::text]));

