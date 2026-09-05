import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, ShoppingCart, Package, AlertTriangle, CalendarClock, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Inventory Management" }] }),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    if (data?.role !== "owner") throw redirect({ to: "/app/pos" });
  },
  component: DashboardPage,
});

type Stats = {
  today_revenue: number; today_count: number;
  week_revenue: number; week_count: number;
  month_revenue: number; today_profit: number; month_profit: number;
  inventory_value: number; medicine_count: number;
  chart: { day: string; sales: number }[];
  payments: { method: string; amount: number }[];
  top_sellers: { name: string; qty: number; revenue: number }[];
  low_stock_count: number;
  low_stock: { id: string; name: string; quantity: number; reorder_level: number }[];
  expiring_count: number;
  expiring: { id: string; name: string; expiry_date: string }[];
};

const ETB = (n: number) => `ETB ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("dashboard_stats");
      setStats((data as unknown as Stats) ?? null);
      setLoading(false);
    })();
  }, []);

  const chart = (stats?.chart ?? []).map((c) => ({ day: c.day, sales: Math.round(Number(c.sales)) }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of sales, profit, stock and alerts</p>
        </div>
        <Button asChild><Link to="/app/pos"><ShoppingCart className="size-4" /> New sale</Link></Button>
      </div>

      {loading || !stats ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KPI icon={DollarSign} label="Today's revenue" value={ETB(stats.today_revenue)} sub={`${stats.today_count} sales`} />
            <KPI icon={TrendingUp} label="Today's profit" value={ETB(stats.today_profit)} sub="est." />
            <KPI icon={ShoppingCart} label="7-day revenue" value={ETB(stats.week_revenue)} sub={`${stats.week_count} sales`} />
            <KPI icon={Package} label="Inventory value" value={ETB(stats.inventory_value)} sub={`${stats.medicine_count} items`} />
          </div>

          {/* Chart + Payments */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Last 7 days revenue</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => ETB(v)} />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Today by payment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {stats.payments.length === 0 ? <div className="text-sm text-muted-foreground">No sales yet today.</div> :
                  stats.payments.map((p) => (
                    <div key={p.method} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{p.method}</span>
                      <span className="font-medium">{ETB(p.amount)}</span>
                    </div>
                  ))}
                <div className="border-t pt-3 flex items-center justify-between font-semibold">
                  <span>Total</span><span>{ETB(stats.today_revenue)}</span>
                </div>
                <div className="text-xs text-muted-foreground">30-day profit: {ETB(stats.month_profit)} · 30-day revenue: {ETB(stats.month_revenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Top sellers + Alerts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Top sellers (30d)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {stats.top_sellers.length === 0 ? <div className="text-sm text-muted-foreground">No sales yet.</div> :
                  stats.top_sellers.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{t.name}</span>
                      <span className="text-muted-foreground">{t.qty} · {ETB(t.revenue)}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Low stock</CardTitle>
                <Badge variant="destructive">{stats.low_stock_count}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.low_stock.length === 0 ? <div className="text-sm text-muted-foreground">All stocked up.</div> :
                  stats.low_stock.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.name}</span>
                      <span className="text-muted-foreground">{m.quantity} / {m.reorder_level}</span>
                    </div>
                  ))}
                <Link to="/app/inventory" className="text-xs text-primary inline-flex items-center gap-1 pt-1">Manage inventory <ArrowRight className="size-3" /></Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="size-4" /> Expiring ≤ 60d</CardTitle>
                <Badge variant="secondary">{stats.expiring_count}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.expiring.length === 0 ? <div className="text-sm text-muted-foreground">Nothing expiring soon.</div> :
                  stats.expiring.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.name}</span>
                      <span className="text-muted-foreground">{m.expiry_date}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
