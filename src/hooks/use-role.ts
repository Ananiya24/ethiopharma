import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "pharmacist";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { if (active) { setRole(null); setPharmacyId(null); setLoading(false); } return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role, pharmacy_id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!active) return;
      setRole((data?.role as AppRole) ?? null);
      setPharmacyId(data?.pharmacy_id ?? null);
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return { role, pharmacyId, loading, isOwner: role === "owner", isPharmacist: role === "pharmacist" };
}
