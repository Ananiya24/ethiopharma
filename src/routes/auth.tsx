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

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function routeAfterLogin() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    const r = data?.role as Role | undefined;
    if (!r) {
      // No pharmacy yet — send them through pharmacy setup (they become its owner).
      navigate({ to: "/app/onboarding", replace: true });
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
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        toast.success("Account created. Set up your pharmacy next.");
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 py-10" style={{ background: "var(--gradient-soft)" }}>
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
        <h1 className="text-2xl font-bold mb-1">{mode === "signup" ? "Register your pharmacy" : "Sign in"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup"
            ? "Create an owner account, then name your pharmacy. Your data stays private to your pharmacy."
            : "Pharmacist accounts are created by the pharmacy owner. Ask the owner for your login credentials."}
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
            {loading ? "Please wait…" : mode === "signup" ? "Create owner account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New pharmacy? Register here"}
          </button>
        </form>
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Designed & built by <span className="font-semibold text-foreground tracking-tight">Zylos Tech</span>
        </div>
      </Card>
    </div>
  );
}

