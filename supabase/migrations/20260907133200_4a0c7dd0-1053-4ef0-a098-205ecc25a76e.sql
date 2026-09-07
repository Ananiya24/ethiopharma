INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'ananiya506@gmail.com'
ON CONFLICT (user_id) DO NOTHING;