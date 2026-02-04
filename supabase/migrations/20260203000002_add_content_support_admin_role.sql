-- Add content_support_admin to profiles.admin_role constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_admin_role_check
CHECK (admin_role = ANY (ARRAY[
    'super_admin'::text,
    'content_admin'::text,
    'support_admin'::text,
    'content_support_admin'::text
]));
