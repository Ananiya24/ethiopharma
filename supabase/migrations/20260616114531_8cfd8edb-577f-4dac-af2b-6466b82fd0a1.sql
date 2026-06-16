
CREATE TABLE public.medicine_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid,
  medicine_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  user_id uuid NOT NULL,
  user_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.medicine_activity_log TO authenticated;
GRANT ALL ON public.medicine_activity_log TO service_role;

ALTER TABLE public.medicine_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read activity log"
ON public.medicine_activity_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated insert own activity"
ON public.medicine_activity_log
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_activity_created_at ON public.medicine_activity_log (created_at DESC);
