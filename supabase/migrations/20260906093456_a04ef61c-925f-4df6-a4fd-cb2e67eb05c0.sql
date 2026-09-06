-- Subscription fields on pharmacies
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.pharmacies DROP CONSTRAINT IF EXISTS pharmacies_subscription_status_check;
ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_subscription_status_check
  CHECK (subscription_status IN ('trial','active','past_due','suspended'));

-- Platform administrators
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read own admin row" ON public.platform_admins;
CREATE POLICY "Admins read own admin row" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.subscription_active(_pharmacy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacies p
    WHERE p.id = _pharmacy_id
      AND p.is_active
      AND p.subscription_status IN ('trial','active','past_due')
      AND p.subscription_ends_at > now()
  )
$$;

-- Subscription payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  method text NOT NULL DEFAULT 'cash',
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins read payments" ON public.subscription_payments;
CREATE POLICY "Platform admins read payments" ON public.subscription_payments
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS "Members read own pharmacy payments" ON public.subscription_payments;
CREATE POLICY "Members read own pharmacy payments" ON public.subscription_payments
  FOR SELECT TO authenticated USING (pharmacy_id = public.current_pharmacy_id());
CREATE INDEX IF NOT EXISTS subscription_payments_pharmacy_idx ON public.subscription_payments(pharmacy_id, created_at DESC);

-- Platform admins can see/manage every pharmacy
DROP POLICY IF EXISTS "Platform admins read all pharmacies" ON public.pharmacies;
CREATE POLICY "Platform admins read all pharmacies" ON public.pharmacies
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_pharmacies()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO res FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'name', p.name, 'phone', p.phone, 'address', p.address,
      'is_active', p.is_active, 'plan', p.plan, 'subscription_status', p.subscription_status,
      'monthly_fee', p.monthly_fee, 'subscription_ends_at', p.subscription_ends_at,
      'admin_notes', p.admin_notes, 'created_at', p.created_at,
      'active', public.subscription_active(p.id),
      'staff_count', (SELECT count(*) FROM public.user_roles ur WHERE ur.pharmacy_id = p.id),
      'medicine_count', (SELECT count(*) FROM public.medicines m WHERE m.pharmacy_id = p.id),
      'sales_count', (SELECT count(*) FROM public.sales s WHERE s.pharmacy_id = p.id),
      'revenue_30d', COALESCE((SELECT sum(s.total_amount) FROM public.sales s
          WHERE s.pharmacy_id = p.id AND s.created_at >= now() - interval '30 days'), 0),
      'paid_total', COALESCE((SELECT sum(sp.amount) FROM public.subscription_payments sp WHERE sp.pharmacy_id = p.id), 0)
    ) AS x
    FROM public.pharmacies p
  ) t;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _pharmacy_id uuid, _status text DEFAULT NULL, _ends_at timestamptz DEFAULT NULL,
  _plan text DEFAULT NULL, _monthly_fee numeric DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('trial','active','past_due','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.pharmacies SET
    subscription_status = COALESCE(_status, subscription_status),
    subscription_ends_at = COALESCE(_ends_at, subscription_ends_at),
    plan = COALESCE(_plan, plan),
    monthly_fee = COALESCE(_monthly_fee, monthly_fee),
    admin_notes = COALESCE(_notes, admin_notes)
  WHERE id = _pharmacy_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_payment(
  _pharmacy_id uuid, _amount numeric, _months integer DEFAULT 1,
  _method text DEFAULT 'cash', _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base timestamptz; new_end timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _months IS NULL OR _months < 1 THEN _months := 1; END IF;
  SELECT GREATEST(subscription_ends_at, now()) INTO base FROM public.pharmacies WHERE id = _pharmacy_id;
  IF base IS NULL THEN RAISE EXCEPTION 'Pharmacy not found'; END IF;
  new_end := base + (_months || ' months')::interval;
  UPDATE public.pharmacies
     SET subscription_ends_at = new_end, subscription_status = 'active'
   WHERE id = _pharmacy_id;
  INSERT INTO public.subscription_payments (pharmacy_id, amount, period_start, period_end, method, note, recorded_by)
  VALUES (_pharmacy_id, COALESCE(_amount,0), current_date, new_end::date, COALESCE(_method,'cash'), _note, auth.uid());
  RETURN jsonb_build_object('subscription_ends_at', new_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_subscription()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.current_pharmacy_id(); r record;
BEGIN
  IF pid IS NULL THEN RETURN NULL; END IF;
  SELECT name, subscription_status, subscription_ends_at, plan, monthly_fee, is_active INTO r
  FROM public.pharmacies WHERE id = pid;
  RETURN jsonb_build_object(
    'pharmacy_id', pid, 'name', r.name, 'status', r.subscription_status,
    'ends_at', r.subscription_ends_at, 'plan', r.plan, 'monthly_fee', r.monthly_fee,
    'active', public.subscription_active(pid),
    'days_left', GREATEST(0, EXTRACT(day FROM (r.subscription_ends_at - now()))::int)
  );
END;
$$;

-- Block sales when the subscription lapsed
CREATE OR REPLACE FUNCTION public.process_sale(_items jsonb, _payment_method text DEFAULT 'cash'::text, _cashier_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  pid uuid;
  item jsonb;
  med RECORD;
  qty integer;
  line_total numeric;
  running_total numeric := 0;
  seq bigint;
  s_number text;
  sale_id uuid;
  user_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM set_config('app.skip_medicine_audit', 'on', true);

  pid := public.current_pharmacy_id();
  IF pid IS NULL THEN RAISE EXCEPTION 'No pharmacy assigned to your account'; END IF;

  IF NOT public.subscription_active(pid) THEN
    RAISE EXCEPTION 'Subscription inactive. Please contact your software provider to renew.';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF _payment_method IS NULL OR btrim(_payment_method) = '' THEN
    _payment_method := 'cash';
  END IF;

  INSERT INTO public.pharmacy_counters (pharmacy_id, last_sale_number)
  VALUES (pid, 1)
  ON CONFLICT (pharmacy_id) DO UPDATE
    SET last_sale_number = public.pharmacy_counters.last_sale_number + 1
  RETURNING last_sale_number INTO seq;

  s_number := 'PH-' || lpad(seq::text, 6, '0');

  INSERT INTO public.sales (sale_number, total_amount, payment_method, cashier_name, pharmacy_id)
  VALUES (s_number, 0, btrim(_payment_method), NULLIF(btrim(coalesce(_cashier_name, '')), ''), pid)
  RETURNING id INTO sale_id;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    qty := (item->>'quantity')::integer;
    IF qty IS NULL OR qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity in cart';
    END IF;

    UPDATE public.medicines
       SET quantity = quantity - qty
     WHERE id = (item->>'medicine_id')::uuid
       AND pharmacy_id = pid
       AND quantity >= qty
    RETURNING id, name, unit_price, quantity INTO med;

    IF NOT FOUND THEN
      SELECT name, quantity INTO med
        FROM public.medicines
       WHERE id = (item->>'medicine_id')::uuid AND pharmacy_id = pid;
      IF med IS NULL THEN
        RAISE EXCEPTION 'Medicine no longer available';
      ELSE
        RAISE EXCEPTION 'Only % left in stock for %', med.quantity, med.name;
      END IF;
    END IF;

    line_total := round(med.unit_price * qty, 2);
    running_total := running_total + line_total;

    INSERT INTO public.sale_items (sale_id, pharmacy_id, medicine_id, medicine_name, quantity, unit_price, subtotal)
    VALUES (sale_id, pid, med.id, med.name, qty, med.unit_price, line_total);

    INSERT INTO public.medicine_activity_log (medicine_id, medicine_name, action, user_id, user_email, details, pharmacy_id)
    VALUES (med.id, med.name, 'sold', uid, user_email,
            jsonb_build_object('quantity', qty, 'sale_number', s_number, 'remaining', med.quantity), pid);
  END LOOP;

  UPDATE public.sales SET total_amount = running_total WHERE id = sale_id;

  RETURN jsonb_build_object('sale_id', sale_id, 'sale_number', s_number, 'total_amount', running_total);
END;
$function$;

-- Existing pharmacies keep working
UPDATE public.pharmacies
   SET subscription_status = 'active', subscription_ends_at = now() + interval '1 year'
 WHERE subscription_ends_at <= now();