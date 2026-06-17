
-- 1) medicines: owner-only INSERT/DELETE
DROP POLICY IF EXISTS "Authenticated can insert medicines" ON public.medicines;
DROP POLICY IF EXISTS "Authenticated can delete medicines" ON public.medicines;

CREATE POLICY "Owners can insert medicines" ON public.medicines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete medicines" ON public.medicines
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 2) sales + sale_items: owner-only SELECT
DROP POLICY IF EXISTS "Authenticated can read sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated can read sale_items" ON public.sale_items;

CREATE POLICY "Owners can read sales" ON public.sales
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can read sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 3) user_roles: prevent self-assigning owner
DROP POLICY IF EXISTS "Users self-assign initial role" ON public.user_roles;

CREATE POLICY "Users self-assign pharmacist role only" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'pharmacist'::app_role
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

-- 4) Controlled owner bootstrap: only the designated email can claim owner once.
CREATE OR REPLACE FUNCTION public.bootstrap_owner_role()
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  existing_role public.app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO existing_role FROM public.user_roles WHERE user_id = uid LIMIT 1;
  IF existing_role IS NOT NULL THEN
    RETURN existing_role;
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF uemail = 'owner@pharmacy.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'owner'::app_role);
    RETURN 'owner'::app_role;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_owner_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner_role() TO authenticated;
