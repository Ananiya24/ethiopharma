import { useLanguage } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { REASON_LABEL } from "@/components/StockAdjustDialog";

type Inv = {
  stock_value_cost: number; stock_value_retail: number; medicine_count: number; units: number;
  by_reason: { reason: string; qty: number; value: number }[];
  movements: { created_at: string; medicine_name: string; change: number; reason: string; note: string | null; user_email: string | null }[];
  reorder: { name: string; quantity: number; reorder_level: number }[];
  expired_in_stock: { name: string; quantity: number; expiry_date: string; value: number }[];
};

const ETB = (n: number) => `ETB ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LOSS = ["damaged", "expired"];

export function InventoryReport({ from, to }: { from: string; to: string }) {
  const { t } = useLanguage();
  const [d, setD] = useState<Inv | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("inventory_report", { _from: from, _to: to }).then(({ data, error }) => {
      if (error) setError(error.message); else { setError(null); setD(data as unknown as Inv); }
    });
  }, [from, to]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!d) return <div className="text-sm text-muted-foreground">{t('Loading…')}</div>;

  const sum = (f: (r: Inv["by_reason"][number]) => boolean, k: "qty" | "value") => d.by_reason.filter(f).reduce((s, r) => s + Number(r[k]), 0);
  const inQty = sum((r) => ["delivery", "returned", "correction_in"].includes(r.reason), "qty");
  const outQty = sum((r) => !["delivery", "returned", "correction_in"].includes(r.reason), "qty");
  const loss = sum((r) => LOSS.includes(r.reason), "value");

  function exportCsv() {
    const lines = ["Date,Medicine,Change,Reason,Note,By"];
    d!.movements.forEach((m) => lines.push([new Date(m.created_at).toLocaleString(), `"${m.medicine_name}"`, m.change, REASON_LABEL[m.reason] ?? m.reason, `"${m.note ?? ""}"`, m.user_email ?? ""].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `stock_movements_${from}_${to}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('Stock value (cost)' )} value={ETB(d.stock_value_cost)} sub={`${d.medicine_count} medicines · ${d.units} units`} />
        <Kpi label={t('Stock value (selling price)' )} value={ETB(d.stock_value_retail)} sub={`Potential profit ${ETB(d.stock_value_retail - d.stock_value_cost)}`} />
        <Kpi label={t('Units in / out' )} value={`+${inQty} / −${outQty}`} sub={t('in this period' )} />
        <Kpi label={t('Losses (damaged + expired)' )} value={ETB(loss)} sub={t('at cost price' )} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('Stock in / out by reason')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.by_reason.length === 0 && <div className="text-muted-foreground">{t('No stock movements in this period.')}</div>}
            {d.by_reason.map((r) => (
              <div key={r.reason} className="flex justify-between gap-2"><span>{t(REASON_LABEL[r.reason] ?? r.reason)}</span><span className="text-muted-foreground">{r.qty} units · {ETB(r.value)}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Need to reorder ({d.reorder.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {d.reorder.length === 0 && <div className="text-muted-foreground">{t('All stocked up.')}</div>}
            {d.reorder.map((r) => <div key={r.name} className="flex justify-between"><span className="truncate pr-2">{r.name}</span><span className="text-muted-foreground">{r.quantity} / {r.reorder_level}</span></div>)}
          </CardContent>
        </Card>
      </div>

      {d.expired_in_stock.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-destructive">{t('Expired but still in stock')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.expired_in_stock.map((r) => <div key={r.name} className="flex justify-between gap-2"><span className="truncate">{r.name} · expired {r.expiry_date}</span><span className="text-muted-foreground">{r.quantity} units · {ETB(r.value)}</span></div>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t('Stock movements')}</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} className="print:hidden"><Download className="size-4" />{t('Excel (CSV)')}</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-left text-muted-foreground border-b border-border"><tr><th className="py-2">{t('Date')}</th><th>{t('Medicine')}</th><th className="text-right">{t('Change')}</th><th>{t('Reason')}</th><th>{t('By')}</th></tr></thead>
            <tbody>
              {d.movements.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{t('No movements yet. Use the Stock in / Stock out buttons on the Inventory page.')}</td></tr>}
              {d.movements.map((m, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                  <td>{m.medicine_name}{m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}</td>
                  <td className={`text-right font-medium ${m.change > 0 ? "text-primary" : "text-destructive"}`}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                  <td className="pl-3">{t(REASON_LABEL[m.reason] ?? m.reason)}</td>
                  <td className="text-xs text-muted-foreground">{m.user_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
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
