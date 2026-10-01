CREATE OR REPLACE FUNCTION public.owner_add_pharmacist(_user_id uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.current_pharmacy_id();
BEGIN
  IF pid IS NULL OR NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Only the pharmacy owner can add staff'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND lower(u.email) = lower(btrim(_email))
                 AND u.created_at > now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'That email already belongs to a pharmacy';
  END IF;
  INSERT INTO public.user_roles (user_id, role, pharmacy_id) VALUES (_user_id, 'pharmacist', pid);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_list_staff()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.current_pharmacy_id(); res jsonb;
BEGIN
  IF pid IS NULL OR NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', r.user_id, 'role', r.role, 'created_at', r.created_at,
    'email', COALESCE(u.email, '(unknown)'), 'confirmed', u.email_confirmed_at IS NOT NULL
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO res
  FROM public.user_roles r LEFT JOIN auth.users u ON u.id = r.user_id WHERE r.pharmacy_id = pid;
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_remove_pharmacist(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.current_pharmacy_id();
BEGIN
  IF pid IS NULL OR NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND pharmacy_id = pid AND role = 'pharmacist';
  IF NOT FOUND THEN RAISE EXCEPTION 'That pharmacist does not belong to your pharmacy'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.owner_add_pharmacist(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_remove_pharmacist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_add_pharmacist(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_remove_pharmacist(uuid) TO authenticated;