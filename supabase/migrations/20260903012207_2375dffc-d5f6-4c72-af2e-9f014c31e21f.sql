-- Prevent negative stock at the storage level
UPDATE public.medicines SET quantity = 0 WHERE quantity < 0;
ALTER TABLE public.medicines ADD CONSTRAINT medicines_quantity_non_negative CHECK (quantity >= 0);

-- Per-pharmacy receipt number counter
CREATE TABLE IF NOT EXISTS public.pharmacy_counters (
  pharmacy_id uuid PRIMARY KEY REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  last_sale_number bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pharmacy_counters TO service_role;
ALTER TABLE public.pharmacy_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own pharmacy counter" ON public.pharmacy_counters
  FOR SELECT TO authenticated USING (pharmacy_id = public.current_pharmacy_id());
GRANT SELECT ON public.pharmacy_counters TO authenticated;

CREATE TRIGGER pharmacy_counters_updated_at BEFORE UPDATE ON public.pharmacy_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic sale processing
CREATE OR REPLACE FUNCTION public.process_sale(
  _items jsonb,
  _payment_method text DEFAULT 'cash',
  _cashier_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  pid := public.current_pharmacy_id();
  IF pid IS NULL THEN RAISE EXCEPTION 'No pharmacy assigned to your account'; END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF _payment_method IS NULL OR btrim(_payment_method) = '' THEN
    _payment_method := 'cash';
  END IF;

  -- Reserve a receipt number for this pharmacy
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

    -- Guarded decrement: only succeeds if enough stock remains right now
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
$$;

REVOKE ALL ON FUNCTION public.process_sale(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_sale(jsonb, text, text) TO authenticated;