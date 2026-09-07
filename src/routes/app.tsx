import { createFileRoute, Link, Outlet, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Boxes, ShoppingCart, Home, LogOut, LayoutDashboard, Users, Activity, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole, useSubscription } from "@/hooks/use-role";

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
  const { isOwner, role, isPlatformAdmin } = useRole();
  const { subscription } = useSubscription();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const allNav = [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
    { to: "/app/inventory", label: "Inventory", icon: Boxes, ownerOnly: false },
    { to: "/app/pos", label: "POS", icon: ShoppingCart, ownerOnly: false },
    { to: "/app/staff", label: "Staff", icon: Users, ownerOnly: true },
    { to: "/app/activity", label: "Activity", icon: Activity, ownerOnly: true },
    { to: "/app/admin", label: "Pharmacies", icon: Building2, ownerOnly: false, adminOnly: true },
  ] as const;
  const nav = allNav.filter((n) => (!n.ownerOnly || isOwner) && (!("adminOnly" in n && n.adminOnly) || isPlatformAdmin));
  const expiry =
    subscription && !isPlatformAdmin
      ? !subscription.active
        ? { tone: "destructive" as const, text: "Your subscription has ended. Selling is disabled — please contact your provider to renew." }
        : subscription.days_left <= 7
          ? { tone: "warning" as const, text: `Your subscription ends in ${subscription.days_left} day${subscription.days_left === 1 ? "" : "s"}. Contact your provider to renew.` }
          : null
      : null;
  return (
    <div className="min-h-screen flex bg-secondary/30">
      <aside className="w-60 border-r border-border bg-card hidden md:flex flex-col">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-border">
          <span className="size-8 rounded-lg grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <Pill className="size-4" />
          </span>
          <div>
            <div className="font-display font-bold text-sm leading-tight">Inventory Management</div>
            <div className="text-[10px] text-muted-foreground">for Pharmacy{role ? ` · ${role}` : ""}</div>
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
          <div className="px-3 pt-2 text-[10px] text-muted-foreground">
            Made with <span className="font-semibold text-foreground">Zylos Tech</span>
          </div>
        </div>

      </aside>
      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border overflow-x-auto pb-[env(safe-area-inset-bottom)]">
        <div className="flex min-w-full w-max">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2.5 text-[11px] leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="size-5" /> <span className="truncate max-w-full px-1">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {expiry && (
          <div
            className={`flex items-start gap-2 px-4 py-3 text-sm ${
              expiry.tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-500"
            }`}
          >
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{expiry.text}</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
