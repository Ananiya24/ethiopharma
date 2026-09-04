CREATE INDEX IF NOT EXISTS idx_sales_pharmacy_created ON public.sales (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_created ON public.sale_items (sale_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_pharmacy_created ON public.sale_items (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medicines_pharmacy_name ON public.medicines (pharmacy_id, name);
CREATE INDEX IF NOT EXISTS idx_activity_pharmacy_created ON public.medicine_activity_log (pharmacy_id, created_at DESC);