import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inventory Management for Pharmacy" },
      { name: "description", content: "Inventory management and point of sale system for pharmacies." },
      { property: "og:title", content: "Inventory Management for Pharmacy" },
      { property: "og:description", content: "Inventory management and point of sale system for pharmacies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/app/dashboard" : "/auth" });
  },
  component: () => null,
});
