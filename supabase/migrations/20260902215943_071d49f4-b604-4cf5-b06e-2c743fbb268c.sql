REVOKE EXECUTE ON FUNCTION public.current_pharmacy_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pharmacy_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_pharmacy_for_current_user(text) FROM anon;