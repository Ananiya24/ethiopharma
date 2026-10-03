UPDATE public.pharmacies SET plan='inventory_pos' WHERE plan NOT IN ('inventory','inventory_pos');
UPDATE public.pharmacies SET monthly_fee = CASE WHEN plan='inventory' THEN 3900 ELSE 6900 END WHERE monthly_fee = 0;
ALTER TABLE public.pharmacies ALTER COLUMN plan SET DEFAULT 'inventory_pos';
ALTER TABLE public.pharmacies ALTER COLUMN monthly_fee SET DEFAULT 6900;
ALTER TABLE public.pharmacies ADD CONSTRAINT pharmacies_plan_check CHECK (plan IN ('inventory','inventory_pos'));

CREATE OR REPLACE FUNCTION public.enforce_pos_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (SELECT plan FROM public.pharmacies WHERE id = NEW.pharmacy_id) = 'inventory' THEN
    RAISE EXCEPTION 'Your plan is Inventory only. Upgrade to Inventory + POS (6,900 birr/month) to sell.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_enforce_pos_plan BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.enforce_pos_plan();

CREATE OR REPLACE FUNCTION public.sales_report(_from date, _to date, _vat_rate numeric DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := public.current_pharmacy_id(); result jsonb;
BEGIN
  IF pid IS NULL OR NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Owners only'; END IF;
  WITH items AS (
    SELECT (s.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date d, s.id sale_id, si.subtotal,
           si.quantity * coalesce(m.cost_price,0) cost, si.medicine_name, si.quantity, s.payment_method
    FROM sales s JOIN sale_items si ON si.sale_id=s.id LEFT JOIN medicines m ON m.id=si.medicine_id
    WHERE s.pharmacy_id=pid AND (s.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date BETWEEN _from AND _to
  ), daily AS (
    SELECT d, count(DISTINCT sale_id) sales, sum(subtotal) revenue, sum(cost) cost FROM items GROUP BY d
  )
  SELECT jsonb_build_object(
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day',d,'sales',sales,'revenue',revenue,'cost',cost,'profit',revenue-cost,
        'vat', round(revenue*_vat_rate/(100+_vat_rate),2)) ORDER BY d) FROM daily),'[]'),
    'payments', coalesce((SELECT jsonb_agg(x) FROM (SELECT payment_method method, sum(subtotal) amount FROM items GROUP BY 1 ORDER BY 2 DESC) x),'[]'),
    'top', coalesce((SELECT jsonb_agg(x) FROM (SELECT medicine_name name, sum(quantity) qty, sum(subtotal) revenue, sum(subtotal)-sum(cost) profit FROM items GROUP BY 1 ORDER BY 3 DESC LIMIT 15) x),'[]')
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sales_report(date,date,numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sales_report(date,date,numeric) TO authenticated;