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
  head: () => ({ meta: [{ title: "Sign in — Droga Pharmacy" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app/inventory", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/app/inventory", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/app/inventory` },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("sign_in");
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
            <div className="font-display font-bold">Droga Pharmacy</div>
            <div className="text-xs text-muted-foreground">Staff sign-in</div>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-1">{mode === "sign_in" ? "Welcome back" : "Create an account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "sign_in" ? "Sign in to access inventory and POS." : "Register a new staff account."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw" className="text-xs">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
          className="mt-5 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "sign_in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
