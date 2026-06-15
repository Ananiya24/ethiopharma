import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inventory Management for Pharmacy" },
      { name: "description", content: "Inventory management and point of sale system for pharmacies." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/app/dashboard" : "/auth" });
  },
  component: () => null,
});
