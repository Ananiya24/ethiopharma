-- 1. Pharmacies
CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pharmacies TO authenticated;
GRANT ALL ON public.pharmacies TO service_role;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pharmacies_updated_at BEFORE UPDATE ON public.pharmacies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Backfill default pharmacy
INSERT INTO public.pharmacies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Pharmacy');

-- 3. Add pharmacy_id columns
ALTER TABLE public.user_roles ADD COLUMN pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.medicines ADD COLUMN pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD COLUMN pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;
ALTER TABLE public.medicine_activity_log ADD COLUMN pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE CASCADE;

UPDATE public.user_roles SET pharmacy_id = '00000000-0000-0000-0000-000000000001' WHERE pharmacy_id IS NULL;
UPDATE public.medicines SET pharmacy_id = '00000000-0000-0000-0000-000000000001' WHERE pharmacy_id IS NULL;
UPDATE public.sales SET pharmacy_id = '00000000-0000-0000-0000-000000000001' WHERE pharmacy_id IS NULL;
UPDATE public.sale_items SET pharmacy_id = '00000000-0000-0000-0000-000000000001' WHERE pharmacy_id IS NULL;
UPDATE public.medicine_activity_log SET pharmacy_id = '00000000-0000-0000-0000-000000000001' WHERE pharmacy_id IS NULL;

ALTER TABLE public.user_roles ALTER COLUMN pharmacy_id SET NOT NULL;
ALTER TABLE public.medicines ALTER COLUMN pharmacy_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN pharmacy_id SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN pharmacy_id SET NOT NULL;
ALTER TABLE public.medicine_activity_log ALTER COLUMN pharmacy_id SET NOT NULL;

-- sale_number unique per pharmacy
CREATE UNIQUE INDEX IF NOT EXISTS sales_pharmacy_sale_number_key ON public.sales (pharmacy_id, sale_number);

CREATE INDEX IF NOT EXISTS idx_medicines_pharmacy ON public.medicines (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_sales_pharmacy_created ON public.sales (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_pharmacy ON public.sale_items (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_activity_pharmacy_created ON public.medicine_activity_log (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_pharmacy ON public.user_roles (pharmacy_id);

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.current_pharmacy_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pharmacy_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_pharmacy_owner(_pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'::app_role AND pharmacy_id = _pharmacy_id
  )
$$;

REVOKE ALL ON FUNCTION public.current_pharmacy_id() FROM public;
REVOKE ALL ON FUNCTION public.is_pharmacy_owner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.current_pharmacy_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pharmacy_owner(uuid) TO authenticated, service_role;

-- Onboarding: signed-in user with no role creates their pharmacy and becomes owner
CREATE OR REPLACE FUNCTION public.create_pharmacy_for_current_user(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Pharmacy name is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    RAISE EXCEPTION 'You already belong to a pharmacy';
  END IF;

  INSERT INTO public.pharmacies (name) VALUES (btrim(_name)) RETURNING id INTO new_id;
  INSERT INTO public.user_roles (user_id, role, pharmacy_id) VALUES (uid, 'owner'::app_role, new_id);
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pharmacy_for_current_user(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_pharmacy_for_current_user(text) TO authenticated;

DROP FUNCTION IF EXISTS public.bootstrap_owner_role();

-- 5. Policies: pharmacies
CREATE POLICY "Members read own pharmacy" ON public.pharmacies
FOR SELECT TO authenticated USING (id = public.current_pharmacy_id());

CREATE POLICY "Owners update own pharmacy" ON public.pharmacies
FOR UPDATE TO authenticated USING (public.is_pharmacy_owner(id)) WITH CHECK (public.is_pharmacy_owner(id));

-- 6. Policies: user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users self-assign pharmacist role only" ON public.user_roles;

CREATE POLICY "Users read own role" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners read pharmacy staff" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_pharmacy_owner(pharmacy_id));

-- 7. Policies: medicines
DROP POLICY IF EXISTS "Authenticated can read medicines" ON public.medicines;
DROP POLICY IF EXISTS "Authenticated can update medicines" ON public.medicines;
DROP POLICY IF EXISTS "Owners can insert medicines" ON public.medicines;
DROP POLICY IF EXISTS "Owners can delete medicines" ON public.medicines;

CREATE POLICY "Staff read pharmacy medicines" ON public.medicines
FOR SELECT TO authenticated USING (pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Staff update pharmacy medicines" ON public.medicines
FOR UPDATE TO authenticated
USING (pharmacy_id = public.current_pharmacy_id())
WITH CHECK (pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Owners insert pharmacy medicines" ON public.medicines
FOR INSERT TO authenticated WITH CHECK (public.is_pharmacy_owner(pharmacy_id));

CREATE POLICY "Owners delete pharmacy medicines" ON public.medicines
FOR DELETE TO authenticated USING (public.is_pharmacy_owner(pharmacy_id));

-- 8. Policies: sales
DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Owners can read sales" ON public.sales;

CREATE POLICY "Staff insert pharmacy sales" ON public.sales
FOR INSERT TO authenticated WITH CHECK (pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Owners read pharmacy sales" ON public.sales
FOR SELECT TO authenticated USING (public.is_pharmacy_owner(pharmacy_id));

-- 9. Policies: sale_items
DROP POLICY IF EXISTS "Authenticated can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Owners can read sale_items" ON public.sale_items;

CREATE POLICY "Staff insert pharmacy sale_items" ON public.sale_items
FOR INSERT TO authenticated WITH CHECK (pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Owners read pharmacy sale_items" ON public.sale_items
FOR SELECT TO authenticated USING (public.is_pharmacy_owner(pharmacy_id));

-- 10. Policies: activity log
DROP POLICY IF EXISTS "Authenticated insert own activity" ON public.medicine_activity_log;
DROP POLICY IF EXISTS "Owners read activity log" ON public.medicine_activity_log;

CREATE POLICY "Staff insert pharmacy activity" ON public.medicine_activity_log
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND pharmacy_id = public.current_pharmacy_id());

CREATE POLICY "Owners read pharmacy activity" ON public.medicine_activity_log
FOR SELECT TO authenticated USING (public.is_pharmacy_owner(pharmacy_id));