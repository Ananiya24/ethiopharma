import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Pharmacies & Subscriptions — Admin" },
      { name: "description", content: "Manage every pharmacy using the software, their subscription status and payments." },
      { property: "og:title", content: "Pharmacies & Subscriptions — Admin" },
      { property: "og:description", content: "Manage every pharmacy using the software, their subscription status and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Row = {
  id: string;
  name: string;
  phone: string | null;
  plan: string;
  subscription_status: "trial" | "active" | "past_due" | "suspended";
  monthly_fee: number;
  subscription_ends_at: string;
  admin_notes: string | null;
  created_at: string;
  active: boolean;
  staff_count: number;
  medicine_count: number;
  sales_count: number;
  revenue_30d: number;
  paid_total: number;
};

const statusStyle: Record<Row["subscription_status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  trial: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  past_due: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  suspended: "bg-destructive/15 text-destructive",
};

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function AdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_pharmacies");
    if (error) { setDenied(true); return; }
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(row: Row, status: Row["subscription_status"]) {
    const { error } = await supabase.rpc("admin_update_subscription", { _pharmacy_id: row.id, _status: status });
    if (error) return toast.error(error.message);
    toast.success(`${row.name} set to ${status.replace("_", " ")}`);
    load();
  }

  async function recordPayment() {
    if (!payFor) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_record_payment", {
      _pharmacy_id: payFor.id,
      _amount: Number(amount || payFor.monthly_fee || 0),
      _months: Math.max(1, Number(months || 1)),
      _method: "cash",
      _note: note || undefined,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded and access extended");
    setPayFor(null); setNote(""); setAmount(""); setMonths("1");
    load();
  }

  async function saveFee(row: Row, fee: string) {
    const value = Number(fee);
    if (Number.isNaN(value) || value === row.monthly_fee) return;
    const { error } = await supabase.rpc("admin_update_subscription", { _pharmacy_id: row.id, _monthly_fee: value });
    if (error) return toast.error(error.message);
    toast.success("Monthly fee updated");
    load();
  }

  if (denied) {
    return (
      <div className="p-6 md:p-10 max-w-lg">
        <Card className="p-8 text-center space-y-2">
          <ShieldAlert className="size-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Administrators only</h1>
          <p className="text-sm text-muted-foreground">This page is reserved for the software provider.</p>
        </Card>
      </div>
    );
  }

  const totalMonthly = (rows ?? []).filter((r) => r.subscription_status === "active").reduce((s, r) => s + Number(r.monthly_fee), 0);
  const activeCount = (rows ?? []).filter((r) => r.active).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Pharmacies</h1>
        <p className="text-sm text-muted-foreground">Every pharmacy using the software, their subscription and payments.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pharmacies</div><div className="text-2xl font-bold">{rows?.length ?? "—"}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">With active access</div><div className="text-2xl font-bold">{rows ? activeCount : "—"}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Monthly recurring</div><div className="text-2xl font-bold">{totalMonthly.toFixed(2)}</div></Card>
      </div>

      <div className="space-y-3">
        {rows?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No pharmacies registered yet.</Card>}
        {rows?.map((r) => {
          const left = daysLeft(r.subscription_ends_at);
          return (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="size-9 rounded-lg bg-secondary grid place-items-center shrink-0"><Building2 className="size-4" /></span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.staff_count} staff · {r.medicine_count} medicines · {r.sales_count} sales · {Number(r.revenue_30d).toFixed(2)} sold in 30 days
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${statusStyle[r.subscription_status]} border-0`}>{r.subscription_status.replace("_", " ")}</Badge>
                  <span className={`text-xs ${left < 0 ? "text-destructive" : left <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {left < 0 ? `expired ${-left}d ago` : `${left}d left`}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <Label className="text-[11px]">Monthly fee</Label>
                  <Input defaultValue={String(r.monthly_fee)} onBlur={(e) => saveFee(r, e.target.value)} />
                </div>
                <div className="w-40">
                  <Label className="text-[11px]">Status</Label>
                  <Select value={r.subscription_status} onValueChange={(v) => setStatus(r, v as Row["subscription_status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="past_due">Past due</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => { setPayFor(r); setAmount(String(r.monthly_fee)); }}>
                  <Wallet className="size-4 mr-2" /> Record payment
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">Paid to date: {Number(r.paid_total).toFixed(2)}</span>
              </div>
            </Card>
          );
        })}
        {!rows && !denied && <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>}
      </div>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment — {payFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Amount received</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label className="text-xs">Months to extend</Label>
              <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank transfer ref…" />
            </div>
            <p className="text-xs text-muted-foreground">Access is extended from the current end date and the pharmacy is set to active.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={saving}>{saving ? "Saving…" : "Save payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
