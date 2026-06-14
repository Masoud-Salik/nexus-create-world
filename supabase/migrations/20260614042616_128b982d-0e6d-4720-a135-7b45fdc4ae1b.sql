INSERT INTO public.user_roles (user_id, role)
VALUES ('ad18b944-ae3f-47e4-8e0b-b5bd835a63c7', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;