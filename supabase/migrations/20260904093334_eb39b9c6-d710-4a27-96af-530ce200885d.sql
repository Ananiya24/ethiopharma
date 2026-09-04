-- 1. Price protection: only owners may change unit_price / cost_price
CREATE OR REPLACE FUNCTION public.enforce_medicine_price_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.skip_medicine_audit', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF (NEW.unit_price IS DISTINCT FROM OLD.unit_price
      OR NEW.cost_price IS DISTINCT FROM OLD.cost_price)
     AND NOT public.is_pharmacy_owner(OLD.pharmacy_id) THEN
    RAISE EXCEPTION 'Only the pharmacy owner can change prices';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS medicines_price_permissions ON public.medicines;
CREATE TRIGGER medicines_price_permissions
BEFORE UPDATE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.enforce_medicine_price_permissions();

-- 2. Automatic activity log for medicines
CREATE OR REPLACE FUNCTION public.audit_medicine_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  act text;
  det jsonb;
  rec record;
  changed jsonb := '{}'::jsonb;
  k text;
BEGIN
  -- Sales handle their own logging inside process_sale()
  IF current_setting('app.skip_medicine_audit', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  IF TG_OP = 'INSERT' THEN
    act := 'create';
    rec := NEW;
    det := jsonb_build_object('values', to_jsonb(NEW) - 'id' - 'created_at' - 'updated_at' - 'pharmacy_id');
  ELSIF TG_OP = 'UPDATE' THEN
    act := 'update';
    rec := NEW;
    FOR k IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      IF k NOT IN ('id','created_at','updated_at','pharmacy_id')
         AND to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k THEN
        changed := changed || jsonb_build_object(
          k, jsonb_build_object('from', to_jsonb(OLD)->k, 'to', to_jsonb(NEW)->k));
      END IF;
    END LOOP;
    IF changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    det := jsonb_build_object('changes', changed);
  ELSE
    act := 'delete';
    rec := OLD;
    det := jsonb_build_object('values', to_jsonb(OLD) - 'id' - 'created_at' - 'updated_at' - 'pharmacy_id');
  END IF;

  INSERT INTO public.medicine_activity_log
    (medicine_id, medicine_name, action, user_id, user_email, details, pharmacy_id)
  VALUES
    (CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE rec.id END,
     rec.name, act, uid, uemail, det, rec.pharmacy_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS medicines_audit ON public.medicines;
CREATE TRIGGER medicines_audit
AFTER INSERT OR UPDATE OR DELETE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.audit_medicine_changes();

-- 3. process_sale should not double-log or trip the price guard
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