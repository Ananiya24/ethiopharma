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
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("pharmacist");
  const [loading, setLoading] = useState(false);

  async function routeAfterLogin() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const userEmail = u.user?.email;
    if (!uid) return;
    let { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    // Auto-grant owner role to the designated owner email if no role row exists yet.
    if (!data && userEmail === OWNER_EMAIL) {
      await supabase.from("user_roles").insert({ user_id: uid, role: "owner" });
      data = { role: "owner" };
    }
    const r = data?.role as Role | undefined;
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
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (mode === "sign_up") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        // If session is returned immediately (email confirmation disabled), assign role now.
        if (data.session && data.user) {
          const { error: rErr } = await supabase.from("user_roles").insert({ user_id: data.user.id, role });
          if (rErr) console.error(rErr);
        }
        toast.success(`Account created as ${role}. Signing you in…`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
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
        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={`py-2 text-sm rounded-md transition ${mode === "sign_in" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className={`py-2 text-sm rounded-md transition ${mode === "sign_up" ? "bg-card shadow-sm font-medium" : "text-muted-foreground"}`}
          >
            Create account
          </button>
        </div>
        <h1 className="text-2xl font-bold mb-1">{mode === "sign_in" ? "Welcome back" : "Create account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "sign_in"
            ? "Sign in to access inventory and POS."
            : "Owners see the full dashboard (sales & profit). Pharmacists only access inventory and POS."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="pw" className="text-xs">Password (min 6 characters)</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {mode === "sign_up" && (
            <div>
              <Label className="text-xs mb-1.5 block">I am a</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["owner", "pharmacist"] as Role[]).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`py-2.5 text-sm rounded-md border transition capitalize ${role === r ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-secondary"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {role === "owner" ? "Full access including dashboard with revenue & profit." : "Inventory and POS only — no profit/revenue dashboard."}
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
