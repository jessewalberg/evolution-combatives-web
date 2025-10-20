-- =====================================================
-- Fix: Create trigger to auto-create profiles for new users
-- =====================================================
-- This trigger was missing, causing new users to not get profile records
-- Migration: 20251019000000_fix_user_profile_trigger.sql

-- Drop trigger if it exists (in case of re-running)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger that fires when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Backfill: Create profiles for existing users without profiles
-- =====================================================

-- Create profiles for any existing auth.users that don't have a profile
INSERT INTO public.profiles (
  id,
  email,
  subscription_tier,
  admin_role,
  last_active,
  full_name,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  'none' as subscription_tier,
  NULL as admin_role,
  NOW() as last_active,
  COALESCE(au.raw_user_meta_data->>'full_name', NULL) as full_name,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- =====================================================
-- Verification queries (informational only)
-- =====================================================

-- These are comments showing how to verify the migration worked
-- Uncomment to run manually if needed:

-- Show how many profiles exist
-- SELECT COUNT(*) as total_profiles FROM public.profiles;

-- Show all profiles with their admin roles
-- SELECT email, admin_role, subscription_tier, created_at
-- FROM public.profiles
-- ORDER BY created_at DESC;

-- Verify trigger exists
-- SELECT tgname, tgenabled 
-- FROM pg_trigger 
-- WHERE tgname = 'on_auth_user_created';

