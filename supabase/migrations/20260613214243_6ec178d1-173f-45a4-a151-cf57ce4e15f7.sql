
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  batch_number TEXT,
  barcode TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  expiry_date DATE,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO anon, authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read medicines" ON public.medicines FOR SELECT USING (true);
CREATE POLICY "Public insert medicines" ON public.medicines FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update medicines" ON public.medicines FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete medicines" ON public.medicines FOR DELETE USING (true);

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  cashier_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO anon, authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sales" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Public insert sales" ON public.sales FOR INSERT WITH CHECK (true);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO anon, authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sale_items" ON public.sale_items FOR SELECT USING (true);
CREATE POLICY "Public insert sale_items" ON public.sale_items FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER medicines_updated_at BEFORE UPDATE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed a few sample medicines for Droga Pharmacy
INSERT INTO public.medicines (name, brand, category, batch_number, quantity, unit_price, cost_price, expiry_date, reorder_level) VALUES
('Paracetamol 500mg', 'Cadila', 'Analgesic', 'PCM-2025-01', 240, 5.00, 3.00, '2027-06-01', 50),
('Amoxicillin 250mg', 'EPHARM', 'Antibiotic', 'AMX-2025-04', 120, 12.00, 8.50, '2026-12-15', 30),
('Ibuprofen 400mg', 'Sino-Ethiopia', 'Analgesic', 'IBU-2025-02', 80, 7.50, 5.00, '2027-03-20', 30),
('ORS Sachet', 'UNICEF', 'Rehydration', 'ORS-2025-09', 500, 8.00, 5.50, '2028-01-01', 100),
('Metformin 500mg', 'Julphar', 'Antidiabetic', 'MET-2025-03', 60, 15.00, 10.00, '2026-09-30', 20),
('Vitamin C 1000mg', 'Bayer', 'Supplement', 'VTC-2025-07', 200, 20.00, 14.00, '2027-11-10', 40);
