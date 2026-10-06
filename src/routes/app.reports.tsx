import { useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer } from "lucide-react";
import { InventoryReport } from "@/components/InventoryReport";
import { useSubscription } from "@/hooks/use-role";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [
    { title: tr("Reports — Inventory Management") },
    { name: "description", content: tr("Daily and weekly sales, VAT and profit reports for your pharmacy.") },
    { property: "og:title", content: tr("Reports — Inventory Management") },
    { property: "og:description", content: tr("Daily and weekly sales, VAT and profit reports for your pharmacy.") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportsPage,
});

type Day = { day: string; sales: number; revenue: number; cost: number; profit: number; vat: number };
type Report = { daily: Day[]; payments: { method: string; amount: number }[]; top: { name: string; qty: number; revenue: number; profit: number }[] };

const ETB = (n: number) => `ETB ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
function weekStart(day: string) {
  const d = new Date(day + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

function ReportsPage() {
  const { t: tr } = useLanguage();
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(iso(today));
  const [vat, setVat] = useState("15");
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { subscription } = useSubscription();
  const invOnly = subscription?.plan === "inventory";
  const [tabPick, setTab] = useState<"sales" | "inventory">("sales");
  const tab = invOnly ? "inventory" : tabPick;

  useEffect(() => {
    if (invOnly) return;
    setError(null);
    supabase.rpc("sales_report", { _from: from, _to: to, _vat_rate: Number(vat) || 0 }).then(({ data, error }) => {
      if (error) setError(error.message); else setData(data as unknown as Report);
    });
  }, [from, to, vat, invOnly]);

  function preset(days: number) {
    setTo(iso(new Date()));
    setFrom(iso(new Date(Date.now() - (days - 1) * 86400000)));
  }

  const rows: Day[] = useMemo(() => {
    const daily = (data?.daily ?? []).map((d) => ({ ...d, revenue: +d.revenue, cost: +d.cost, profit: +d.profit, vat: +d.vat }));
    if (view === "daily") return daily;
    const m = new Map<string, Day>();
    for (const d of daily) {
      const k = weekStart(d.day);
      const w = m.get(k) ?? { day: k, sales: 0, revenue: 0, cost: 0, profit: 0, vat: 0 };
      w.sales += d.sales; w.revenue += d.revenue; w.cost += d.cost; w.profit += d.profit; w.vat += d.vat;
      m.set(k, w);
    }
    return [...m.values()];
  }, [data, view]);

  const t = rows.reduce((a, r) => ({ sales: a.sales + r.sales, revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit, vat: a.vat + r.vat }), { sales: 0, revenue: 0, cost: 0, profit: 0, vat: 0 });

  function exportCsv() {
    const lines = [[view === "daily" ? "Date" : "Week of", "Sales", "Revenue", "VAT", "Revenue excl. VAT", "Cost", "Profit"].join(",")];
    rows.forEach((r) => lines.push([r.day, r.sales, r.revenue.toFixed(2), r.vat.toFixed(2), (r.revenue - r.vat).toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2)].join(",")));
    lines.push(["TOTAL", t.sales, t.revenue.toFixed(2), t.vat.toFixed(2), (t.revenue - t.vat).toFixed(2), t.cost.toFixed(2), t.profit.toFixed(2)].join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `report_${from}_${to}.csv`;
    a.click();
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{tr('Reports')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{invOnly ? tr("Stock value, stock in/out, losses and reorders") : tr("Sales, VAT, profit and stock for any period")}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {!invOnly && (
            <div className="flex rounded-md border border-border p-0.5">
              <Button size="sm" variant={tab === "sales" ? "default" : "ghost"} onClick={() => setTab("sales")}>{tr('Sales')}</Button>
              <Button size="sm" variant={tab === "inventory" ? "default" : "ghost"} onClick={() => setTab("inventory")}>{tr('Inventory')}</Button>
            </div>
          )}
          {tab === "sales" && <Button variant="outline" onClick={exportCsv}><Download className="size-4" />{tr('Excel (CSV)')}</Button>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />{tr('Print')}</Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 grid gap-3 grid-cols-2 md:grid-cols-5 items-end">
          <div><Label className="text-xs">{tr('From')}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{tr('To')}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {tab === "sales" && <div><Label className="text-xs">{tr('VAT % (included in prices)')}</Label><Input inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} /></div>}
          <div className="col-span-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => preset(1)}>{tr('Today')}</Button>
            <Button size="sm" variant="secondary" onClick={() => preset(7)}>{tr('7 days')}</Button>
            <Button size="sm" variant="secondary" onClick={() => preset(30)}>{tr('30 days')}</Button>
            {tab === "sales" && <>
            <Button size="sm" variant={view === "daily" ? "default" : "outline"} onClick={() => setView("daily")}>{tr('Daily')}</Button>
            <Button size="sm" variant={view === "weekly" ? "default" : "outline"} onClick={() => setView("weekly")}>{tr('Weekly')}</Button>
            </>}
          </div>
        </CardContent>
      </Card>

      {tab === "inventory" ? <InventoryReport from={from} to={to} /> : <>
      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label={tr('Revenue' )} value={ETB(t.revenue)} sub={`${t.sales} sales`} />
        <Kpi label={tr('VAT collected' )} value={ETB(t.vat)} sub={`Excl. VAT: ${ETB(t.revenue - t.vat)}`} />
        <Kpi label={tr('Cost of goods' )} value={ETB(t.cost)} />
        <Kpi label={tr('Gross profit' )} value={ETB(t.profit)} sub={t.revenue ? `${((t.profit / t.revenue) * 100).toFixed(1)}% margin` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{view === "daily" ? tr("Daily") : tr("Weekly")} breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr><th className="py-2">{view === "daily" ? tr("Date") : tr("Week of")}</th><th>{tr('Sales')}</th><th className="text-right">{tr('Revenue')}</th><th className="text-right">{tr('VAT')}</th><th className="text-right">{tr('Cost')}</th><th className="text-right">{tr('Profit')}</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{tr('No sales in this period.')}</td></tr>}
              {rows.map((r) => (
                <tr key={r.day} className="border-b border-border last:border-0">
                  <td className="py-2">{r.day}</td><td>{r.sales}</td>
                  <td className="text-right">{ETB(r.revenue)}</td><td className="text-right">{ETB(r.vat)}</td>
                  <td className="text-right">{ETB(r.cost)}</td><td className="text-right font-medium">{ETB(r.profit)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="font-semibold border-t border-border">
                <tr><td className="py-2">{tr('Total')}</td><td>{t.sales}</td><td className="text-right">{ETB(t.revenue)}</td><td className="text-right">{ETB(t.vat)}</td><td className="text-right">{ETB(t.cost)}</td><td className="text-right">{ETB(t.profit)}</td></tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('By payment method')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.payments ?? []).length === 0 && <div className="text-muted-foreground">{tr('No data.')}</div>}
            {data?.payments.map((p) => <div key={p.method} className="flex justify-between"><span className="capitalize">{p.method}</span><span>{ETB(p.amount)}</span></div>)}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">{tr('Best sellers & profit')}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">{tr('Medicine')}</th><th>{tr('Qty')}</th><th className="text-right">{tr('Revenue')}</th><th className="text-right">{tr('Profit')}</th></tr></thead>
              <tbody>
                {data?.top.map((m) => <tr key={m.name}><td className="py-1 pr-2">{m.name}</td><td>{m.qty}</td><td className="text-right">{ETB(m.revenue)}</td><td className="text-right">{ETB(m.profit)}</td></tr>)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">{tr("Profit uses each medicine's current cost price. VAT is calculated as the share of the selling price at the rate above.")}</p>
      </>}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg sm:text-xl font-bold mt-1 break-words">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent></Card>
  );
}
