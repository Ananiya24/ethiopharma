import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Pill } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Inventory Management for Pharmacy" }] }),
  component: AuthPage,
});

type Role = "owner" | "pharmacist";
const OWNER_EMAIL = "owner@pharmacy.com";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function routeAfterLogin() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const userEmail = u.user?.email;
    if (!uid) return;
    let { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    // Controlled bootstrap: the server-side function will only grant owner if the
    // authenticated user's email matches the designated owner email.
    if (!data && userEmail === OWNER_EMAIL) {
      const { data: r } = await supabase.rpc("bootstrap_owner_role");
      if (r) data = { role: r };
    }
    const r = data?.role as Role | undefined;
    if (!r) {
      // No role assigned — sign them out, account must be created by the owner.
      await supabase.auth.signOut();
      toast.error("This account has no role assigned. Ask the owner to create your account.");
      return;
    }
    navigate({ to: r === "pharmacist" ? "/app/pos" : "/app/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) routeAfterLogin(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) routeAfterLogin();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4" style={{ background: "var(--gradient-soft)" }}>
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="size-10 rounded-lg grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <Pill className="size-5" />
          </span>
          <div>
            <div className="font-display font-bold leading-tight">Inventory Management</div>
            <div className="text-xs text-muted-foreground">for Pharmacy</div>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Pharmacist accounts are created by the pharmacy owner. Ask the owner for your login credentials.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.com" />
          </div>
          <div>
            <Label htmlFor="pw" className="text-xs">Password</Label>
            <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : "Sign in"}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        Made with <span className="font-semibold text-foreground">Zylos Tech</span>
      </p>
    </div>

  );
}
