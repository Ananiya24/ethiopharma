CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pid uuid := public.current_pharmacy_id();
  today timestamptz := date_trunc('day', now());
  week_start timestamptz := date_trunc('day', now()) - interval '6 days';
  month_start timestamptz := date_trunc('day', now()) - interval '29 days';
  res jsonb;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'No pharmacy assigned to your account'; END IF;
  IF NOT public.is_pharmacy_owner(pid) THEN RAISE EXCEPTION 'Only the pharmacy owner can view the dashboard'; END IF;

  SELECT jsonb_build_object(
    'today_revenue', COALESCE((SELECT sum(total_amount) FROM sales WHERE pharmacy_id = pid AND created_at >= today), 0),
    'today_count',   COALESCE((SELECT count(*) FROM sales WHERE pharmacy_id = pid AND created_at >= today), 0),
    'week_revenue',  COALESCE((SELECT sum(total_amount) FROM sales WHERE pharmacy_id = pid AND created_at >= week_start), 0),
    'week_count',    COALESCE((SELECT count(*) FROM sales WHERE pharmacy_id = pid AND created_at >= week_start), 0),
    'month_revenue', COALESCE((SELECT sum(total_amount) FROM sales WHERE pharmacy_id = pid AND created_at >= month_start), 0),
    'today_profit', COALESCE((
      SELECT sum((si.unit_price - COALESCE(m.cost_price, 0)) * si.quantity)
      FROM sale_items si LEFT JOIN medicines m ON m.id = si.medicine_id
      WHERE si.pharmacy_id = pid AND si.created_at >= today), 0),
    'month_profit', COALESCE((
      SELECT sum((si.unit_price - COALESCE(m.cost_price, 0)) * si.quantity)
      FROM sale_items si LEFT JOIN medicines m ON m.id = si.medicine_id
      WHERE si.pharmacy_id = pid AND si.created_at >= month_start), 0),
    'inventory_value', COALESCE((SELECT sum(quantity * cost_price) FROM medicines WHERE pharmacy_id = pid), 0),
    'medicine_count',  COALESCE((SELECT count(*) FROM medicines WHERE pharmacy_id = pid), 0),
    'chart', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', to_char(d.day, 'Dy'), 'sales', COALESCE(x.total, 0)) ORDER BY d.day)
      FROM generate_series(week_start, today, interval '1 day') AS d(day)
      LEFT JOIN LATERAL (
        SELECT sum(s.total_amount) AS total FROM sales s
        WHERE s.pharmacy_id = pid AND s.created_at >= d.day AND s.created_at < d.day + interval '1 day'
      ) x ON true), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('method', p.payment_method, 'amount', p.amt) ORDER BY p.amt DESC)
      FROM (SELECT payment_method, sum(total_amount) AS amt FROM sales
            WHERE pharmacy_id = pid AND created_at >= today GROUP BY payment_method) p), '[]'::jsonb),
    'top_sellers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.medicine_name, 'qty', t.qty, 'revenue', t.revenue) ORDER BY t.qty DESC)
      FROM (SELECT medicine_name, sum(quantity) AS qty, sum(subtotal) AS revenue
            FROM sale_items WHERE pharmacy_id = pid AND created_at >= month_start
            GROUP BY medicine_name ORDER BY sum(quantity) DESC LIMIT 5) t), '[]'::jsonb),
    'low_stock_count', COALESCE((SELECT count(*) FROM medicines WHERE pharmacy_id = pid AND quantity <= reorder_level), 0),
    'low_stock', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'quantity', l.quantity, 'reorder_level', l.reorder_level) ORDER BY l.quantity)
      FROM (SELECT id, name, quantity, reorder_level FROM medicines
            WHERE pharmacy_id = pid AND quantity <= reorder_level ORDER BY quantity LIMIT 6) l), '[]'::jsonb),
    'expiring_count', COALESCE((SELECT count(*) FROM medicines WHERE pharmacy_id = pid AND expiry_date IS NOT NULL AND expiry_date <= (current_date + 60)), 0),
    'expiring', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'expiry_date', e.expiry_date) ORDER BY e.expiry_date)
      FROM (SELECT id, name, expiry_date FROM medicines
            WHERE pharmacy_id = pid AND expiry_date IS NOT NULL AND expiry_date <= (current_date + 60)
            ORDER BY expiry_date LIMIT 6) e), '[]'::jsonb)
  ) INTO res;

  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;