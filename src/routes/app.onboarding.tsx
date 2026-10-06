import { useLanguage } from "@/lib/i18n";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Check } from "lucide-react";
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

const PLANS = [
  { id: "inventory" as const, name: "Inventory", price: "3,900", features: ["Medicines, batches, expiry & barcodes", "Stock in / stock out with reasons", "Low-stock & expiry alerts", "Inventory reports & staff accounts"] },
  { id: "inventory_pos" as const, name: "Inventory + POS", price: "6,900", features: ["Everything in Inventory", "Point of sale with receipts (works offline)", "Daily/weekly sales, VAT & profit reports"] },
];

function OnboardingPage() {
  const { t, language, setLanguage } = useLanguage();
  
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<"inventory" | "inventory_pos" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error(t('Pharmacy name is required'));
    if (!plan) return toast.error(t('Please choose a plan'));
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_pharmacy_for_current_user", { _name: name.trim(), _plan: plan });
      if (error) throw error;
      toast.success(t('Pharmacy created — your 14-day free trial has started'));
      window.location.assign(plan === "inventory" ? "/app/inventory" : "/app/dashboard");
      return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not create pharmacy"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <span className="size-11 rounded-lg grid place-items-center text-primary-foreground mb-4" style={{ background: "var(--gradient-hero)" }}>
          <Building2 className="size-5" />
        </span>
        <h1 className="text-2xl font-bold mb-1">{t('Set up your pharmacy')}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your pharmacy gets its own private inventory, sales and staff. Nothing is shared with other pharmacies.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="pname" className="text-xs">{t('Pharmacy name')}</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abebe Pharmacy" required />
          </div>
          <div>
            <Label className="text-xs">{t('Choose your plan')}</Label>
            <div className="grid gap-2 mt-1">
              {PLANS.map((p) => (
                <button type="button" key={p.id} onClick={() => setPlan(p.id)}
                  className={`text-left rounded-lg border p-3 transition ${plan === p.id ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className="font-bold whitespace-nowrap">{p.price} <span className="text-xs font-normal text-muted-foreground">{t('birr/month')}</span></span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {p.features.map((f) => <li key={f} className="text-xs text-muted-foreground flex gap-1.5"><Check className="size-3.5 text-primary shrink-0 mt-px" />{f}</li>)}
                  </ul>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('14 days free. After that, pay your provider monthly to keep access.')}</p>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? t("Creating…") : t("Create pharmacy")}</Button>
        </form>
      </Card>
    </div>
  );
}
