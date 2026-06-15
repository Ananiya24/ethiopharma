import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    const role = data?.role as "owner" | "pharmacist" | undefined;
    throw redirect({ to: role === "pharmacist" ? "/app/pos" : "/app/dashboard" });
  },
  component: () => null,
});
