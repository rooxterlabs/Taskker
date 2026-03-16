INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'rodmon@rooxterfilms.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin'::public.app_role;