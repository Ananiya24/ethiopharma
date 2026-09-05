import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your pharmacy — Inventory Management" },
      { name: "description", content: "Create your pharmacy workspace to start managing inventory, sales and staff." },
      { property: "og:title", content: "Set up your pharmacy" },
      { property: "og:description", content: "Create your pharmacy workspace to start managing inventory, sales and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    if (data?.role) throw redirect({ to: data.role === "pharmacist" ? "/app/pos" : "/app/dashboard" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Pharmacy name is required");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_pharmacy_for_current_user", { _name: name.trim() });
      if (error) throw error;
      toast.success("Pharmacy created");
      // Full reload so the sidebar picks up the new owner role immediately
      window.location.assign("/app/dashboard");
      return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create pharmacy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md p-8">
        <span className="size-11 rounded-lg grid place-items-center text-primary-foreground mb-4" style={{ background: "var(--gradient-hero)" }}>
          <Building2 className="size-5" />
        </span>
        <h1 className="text-2xl font-bold mb-1">Set up your pharmacy</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your pharmacy gets its own private inventory, sales and staff. Nothing is shared with other pharmacies.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="pname" className="text-xs">Pharmacy name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abebe Pharmacy" required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create pharmacy"}</Button>
        </form>
      </Card>
    </div>
  );
}
