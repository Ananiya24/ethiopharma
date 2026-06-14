import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Boxes, ShoppingCart, Home, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const nav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/inventory", label: "Inventory", icon: Boxes },
    { to: "/app/pos", label: "POS", icon: ShoppingCart },
  ];
  return (
    <div className="min-h-screen flex bg-secondary/30">
      <aside className="w-60 border-r border-border bg-card hidden md:flex flex-col">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-border">
          <span className="size-8 rounded-lg grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <Pill className="size-4" />
          </span>
          <div>
            <div className="font-display font-bold text-sm leading-tight">Droga Pharmacy</div>
            <div className="text-[10px] text-muted-foreground">MedixPharm</div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 space-y-1">
          {email && <div className="px-3 text-[11px] text-muted-foreground truncate">{email}</div>}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-3.5 mr-2" /> Sign out
          </Button>
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary">
            <Home className="size-3.5" /> Back to website
          </Link>
        </div>
      </aside>
      {/* Mobile top nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border grid grid-cols-3">
        {nav.map((n) => {
          const Icon = n.icon;
          const active = pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center py-3 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="size-5 mb-0.5" /> {n.label}
            </Link>
          );
        })}
      </div>
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
