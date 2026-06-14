import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, ShoppingCart, Package, AlertTriangle, CalendarClock, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Droga Pharmacy" }] }),
  component: DashboardPage,
});

type Sale = { id: string; total_amount: number; payment_method: string; created_at: string };
type SaleItem = { medicine_name: string; quantity: number; subtotal: number; unit_price: number; medicine_id: string | null; created_at: string };
type Medicine = { id: string; name: string; quantity: number; cost_price: number; unit_price: number; reorder_level: number; expiry_date: string | null };

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function daysAgo(n: number) { const d = startOfToday(); d.setDate(d.getDate() - n); return d; }
const ETB = (n: number) => `ETB ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = daysAgo(29).toISOString();
      const [s, i, m] = await Promise.all([
        supabase.from("sales").select("id,total_amount,payment_method,created_at").gte("created_at", since).order("created_at", { ascending: false }),
        supabase.from("sale_items").select("medicine_name,quantity,subtotal,unit_price,medicine_id,created_at").gte("created_at", since),
        supabase.from("medicines").select("id,name,quantity,cost_price,unit_price,reorder_level,expiry_date"),
      ]);
      setSales((s.data as Sale[]) ?? []);
      setItems((i.data as SaleItem[]) ?? []);
      setMeds((m.data as Medicine[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const today = startOfToday();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);

  const inRange = (iso: string, from: Date) => new Date(iso) >= from;

  const todaySales = sales.filter(s => inRange(s.created_at, today));
  const weekSales = sales.filter(s => inRange(s.created_at, weekStart));
  const monthSales = sales.filter(s => inRange(s.created_at, monthStart));

  const sum = (arr: Sale[]) => arr.reduce((a, s) => a + Number(s.total_amount), 0);
  const todayRevenue = sum(todaySales);
  const weekRevenue = sum(weekSales);
  const monthRevenue = sum(monthSales);

  // Profit = sum((unit_price - cost_price) * qty) per sale_item using current med cost as approximation
  const costMap = new Map(meds.map(m => [m.id, Number(m.cost_price)]));
  const profitFor = (it: SaleItem) => {
    const cost = it.medicine_id ? (costMap.get(it.medicine_id) ?? 0) : 0;
    return (Number(it.unit_price) - cost) * it.quantity;
  };
  const todayProfit = items.filter(i => inRange(i.created_at, today)).reduce((a, i) => a + profitFor(i), 0);
  const monthProfit = items.filter(i => inRange(i.created_at, monthStart)).reduce((a, i) => a + profitFor(i), 0);

  // 7-day chart
  const chart = Array.from({ length: 7 }, (_, idx) => {
    const day = daysAgo(6 - idx);
    const next = new Date(day); next.setDate(day.getDate() + 1);
    const label = day.toLocaleDateString(undefined, { weekday: "short" });
    const total = sales.filter(s => { const d = new Date(s.created_at); return d >= day && d < next; }).reduce((a, s) => a + Number(s.total_amount), 0);
    return { day: label, sales: Math.round(total) };
  });

  // Top sellers (30d)
  const topMap = new Map<string, { name: string; qty: number; revenue: number }>();
  items.forEach(it => {
    const e = topMap.get(it.medicine_name) ?? { name: it.medicine_name, qty: 0, revenue: 0 };
    e.qty += it.quantity; e.revenue += Number(it.subtotal);
    topMap.set(it.medicine_name, e);
  });
  const topSellers = [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Payment breakdown today
  const payMap = new Map<string, number>();
  todaySales.forEach(s => payMap.set(s.payment_method, (payMap.get(s.payment_method) ?? 0) + Number(s.total_amount)));

  // Alerts
  const lowStock = meds.filter(m => m.quantity <= m.reorder_level).sort((a,b) => a.quantity - b.quantity);
  const in60 = new Date(); in60.setDate(in60.getDate() + 60);
  const expiringSoon = meds.filter(m => m.expiry_date && new Date(m.expiry_date) <= in60).sort((a,b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));

  const inventoryValue = meds.reduce((a, m) => a + m.quantity * Number(m.cost_price), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of sales, profit, stock and alerts</p>
        </div>
        <Button asChild><Link to="/app/pos"><ShoppingCart className="size-4" /> New sale</Link></Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KPI icon={DollarSign} label="Today's revenue" value={ETB(todayRevenue)} sub={`${todaySales.length} sales`} />
            <KPI icon={TrendingUp} label="Today's profit" value={ETB(todayProfit)} sub="est." />
            <KPI icon={ShoppingCart} label="7-day revenue" value={ETB(weekRevenue)} sub={`${weekSales.length} sales`} />
            <KPI icon={Package} label="Inventory value" value={ETB(inventoryValue)} sub={`${meds.length} items`} />
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
                {payMap.size === 0 ? <div className="text-sm text-muted-foreground">No sales yet today.</div> :
                  [...payMap.entries()].map(([method, amt]) => (
                    <div key={method} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{method}</span>
                      <span className="font-medium">{ETB(amt)}</span>
                    </div>
                  ))}
                <div className="border-t pt-3 flex items-center justify-between font-semibold">
                  <span>Total</span><span>{ETB(todayRevenue)}</span>
                </div>
                <div className="text-xs text-muted-foreground">30-day profit: {ETB(monthProfit)} · 30-day revenue: {ETB(monthRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Top sellers + Alerts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Top sellers (30d)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topSellers.length === 0 ? <div className="text-sm text-muted-foreground">No sales yet.</div> :
                  topSellers.map(t => (
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
                <Badge variant="destructive">{lowStock.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {lowStock.length === 0 ? <div className="text-sm text-muted-foreground">All stocked up.</div> :
                  lowStock.slice(0, 6).map(m => (
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
                <Badge variant="secondary">{expiringSoon.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiringSoon.length === 0 ? <div className="text-sm text-muted-foreground">Nothing expiring soon.</div> :
                  expiringSoon.slice(0, 6).map(m => (
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
