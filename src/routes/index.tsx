import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Droga Pharmacy — Inventory & POS" },
      { name: "description", content: "Inventory management and point of sale for Droga Pharmacy." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/app/inventory" : "/auth" });
  },
  component: () => null,
});
