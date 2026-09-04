REVOKE ALL ON FUNCTION public.audit_medicine_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_medicine_price_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;