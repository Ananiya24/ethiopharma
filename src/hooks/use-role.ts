import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "pharmacist";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { if (active) { setRole(null); setPharmacyId(null); setIsPlatformAdmin(false); setLoading(false); } return; }
      const [{ data }, { data: adminFlag }] = await Promise.all([
        supabase.from("user_roles").select("role, pharmacy_id").eq("user_id", uid).maybeSingle(),
        supabase.rpc("is_platform_admin"),
      ]);
      if (!active) return;
      setRole((data?.role as AppRole) ?? null);
      setPharmacyId(data?.pharmacy_id ?? null);
      setIsPlatformAdmin(adminFlag === true);
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return { role, pharmacyId, loading, isPlatformAdmin, isOwner: role === "owner", isPharmacist: role === "pharmacist" };
}

export type MySubscription = {
  pharmacy_id: string;
  name: string;
  status: "trial" | "active" | "past_due" | "suspended";
  ends_at: string;
  plan: string;
  monthly_fee: number;
  active: boolean;
  days_left: number;
};

export function useSubscription() {
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.rpc("my_subscription").then(({ data }) => {
      if (!active) return;
      setSub((data as unknown as MySubscription) ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return { subscription: sub, loading };
}
