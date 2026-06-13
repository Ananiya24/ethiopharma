
-- medicines: drop public policies, add authenticated-only
DROP POLICY IF EXISTS "Public read medicines" ON public.medicines;
DROP POLICY IF EXISTS "Public insert medicines" ON public.medicines;
DROP POLICY IF EXISTS "Public update medicines" ON public.medicines;
DROP POLICY IF EXISTS "Public delete medicines" ON public.medicines;

REVOKE ALL ON public.medicines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;

CREATE POLICY "Authenticated can read medicines" ON public.medicines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert medicines" ON public.medicines
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update medicines" ON public.medicines
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete medicines" ON public.medicines
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- sales
DROP POLICY IF EXISTS "Public read sales" ON public.sales;
DROP POLICY IF EXISTS "Public insert sales" ON public.sales;

REVOKE ALL ON public.sales FROM anon;
GRANT SELECT, INSERT ON public.sales TO authenticated;

CREATE POLICY "Authenticated can read sales" ON public.sales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- sale_items
DROP POLICY IF EXISTS "Public read sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Public insert sale_items" ON public.sale_items;

REVOKE ALL ON public.sale_items FROM anon;
GRANT SELECT, INSERT ON public.sale_items TO authenticated;

CREATE POLICY "Authenticated can read sale_items" ON public.sale_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sale_items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
