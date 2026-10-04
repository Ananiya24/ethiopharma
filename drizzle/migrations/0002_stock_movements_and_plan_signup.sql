CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id),
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  change integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('delivery','returned','correction_in','dispensed','damaged','expired','correction_out')),
  note text,
  unit_cost numeric NOT NULL DEFAULT 0,
  user_id uuid NOT NULL,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read pharmacy stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (pharmacy_id = public.current_pharmacy_id());
CREATE INDEX stock_movements_pharmacy_created ON public.stock_movements(pharmacy_id, created_at);

CREATE OR REPLACE FUNCTION public.adjust_stock(_medicine_id uuid, _quantity integer, _reason text, _note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); pid uuid := public.current_pharmacy_id(); m record; delta int; em text;
BEGIN
  IF uid IS NULL OR pid IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.subscription_active(pid) THEN RAISE EXCEPTION 'Subscription inactive. Please contact your software provider to renew.'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be more than 0'; END IF;
  IF _reason IN ('delivery','returned','correction_in') THEN delta := _quantity;
  ELSIF _reason IN ('dispensed','damaged','expired','correction_out') THEN delta := -_quantity;
  ELSE RAISE EXCEPTION 'Invalid reason'; END IF;
  PERFORM set_config('app.skip_medicine_audit','on',true);
  UPDATE medicines SET quantity = quantity + delta
   WHERE id=_medicine_id AND pharmacy_id=pid AND quantity + delta >= 0
   RETURNING id,name,quantity,cost_price INTO m;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM medicines WHERE id=_medicine_id AND pharmacy_id=pid) THEN RAISE EXCEPTION 'Not enough stock to remove that many'; END IF;
    RAISE EXCEPTION 'Medicine not found';
  END IF;
  SELECT email INTO em FROM auth.users WHERE id=uid;
  INSERT INTO stock_movements(pharmacy_id,medicine_id,medicine_name,change,reason,note,unit_cost,user_id,user_email)
  VALUES (pid,m.id,m.name,delta,_reason,NULLIF(btrim(coalesce(_note,'')),''),m.cost_price,uid,em);
  INSERT INTO medicine_activity_log(medicine_id,medicine_name,action,user_id,user_email,details,pharmacy_id)
  VALUES (m.id,m.name,'update',uid,em,jsonb_build_object('stock_change',delta,'reason',_reason,'note',_note,'remaining',m.quantity),pid);
  RETURN m.quantity;
END $$;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid,integer,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.inventory_report(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := public.current_pharmacy_id(); res jsonb;
BEGIN
  IF pid IS NULL OR NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Owners only'; END IF;
  WITH mv AS (
    SELECT * FROM stock_movements WHERE pharmacy_id=pid
      AND (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN _from AND _to
  )
  SELECT jsonb_build_object(
    'stock_value_cost', coalesce((SELECT sum(quantity*cost_price) FROM medicines WHERE pharmacy_id=pid),0),
    'stock_value_retail', coalesce((SELECT sum(quantity*unit_price) FROM medicines WHERE pharmacy_id=pid),0),
    'medicine_count', (SELECT count(*) FROM medicines WHERE pharmacy_id=pid),
    'units', coalesce((SELECT sum(quantity) FROM medicines WHERE pharmacy_id=pid),0),
    'by_reason', coalesce((SELECT jsonb_agg(x) FROM (SELECT reason, sum(abs(change)) qty, sum(abs(change)*unit_cost) value FROM mv GROUP BY reason ORDER BY reason) x),'[]'),
    'movements', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (SELECT created_at, medicine_name, change, reason, note, user_email FROM mv ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'reorder', coalesce((SELECT jsonb_agg(x) FROM (SELECT name, quantity, reorder_level FROM medicines WHERE pharmacy_id=pid AND quantity<=reorder_level ORDER BY quantity LIMIT 50) x),'[]'),
    'expired_in_stock', coalesce((SELECT jsonb_agg(x) FROM (SELECT name, quantity, expiry_date, quantity*cost_price value FROM medicines WHERE pharmacy_id=pid AND expiry_date < current_date AND quantity>0 ORDER BY expiry_date) x),'[]')
  ) INTO res;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.inventory_report(date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.inventory_report(date,date) TO authenticated;

DROP FUNCTION public.create_pharmacy_for_current_user(text);
CREATE FUNCTION public.create_pharmacy_for_current_user(_name text, _plan text DEFAULT 'inventory_pos')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR btrim(_name)='' THEN RAISE EXCEPTION 'Pharmacy name is required'; END IF;
  IF _plan NOT IN ('inventory','inventory_pos') THEN RAISE EXCEPTION 'Please choose a plan'; END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id=uid) THEN RAISE EXCEPTION 'You already belong to a pharmacy'; END IF;
  INSERT INTO pharmacies(name, plan, monthly_fee) VALUES (btrim(_name), _plan, CASE WHEN _plan='inventory' THEN 3900 ELSE 6900 END) RETURNING id INTO new_id;
  INSERT INTO user_roles(user_id, role, pharmacy_id) VALUES (uid,'owner'::app_role,new_id);
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_pharmacy_for_current_user(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_pharmacy_for_current_user(text,text) TO authenticated;