import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Inventory Management" }] }),
  component: InventoryPage,
});

type Medicine = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  batch_number: string | null;
  barcode: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  expiry_date: string | null;
  reorder_level: number;
};

const empty = {
  name: "", brand: "", category: "", batch_number: "", barcode: "",
  quantity: 0, unit_price: 0, cost_price: 0, expiry_date: "", reorder_level: 10,
};

function InventoryPage() {
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("medicines").select("*").order("name");
    if (error) toast.error(error.message);
    setItems((data as Medicine[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(m: Medicine) {
    setEditing(m);
    setForm({
      name: m.name, brand: m.brand ?? "", category: m.category ?? "",
      batch_number: m.batch_number ?? "", barcode: m.barcode ?? "",
      quantity: m.quantity, unit_price: Number(m.unit_price), cost_price: Number(m.cost_price),
      expiry_date: m.expiry_date ?? "", reorder_level: m.reorder_level,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      ...form,
      brand: form.brand || null,
      category: form.category || null,
      batch_number: form.batch_number || null,
      barcode: form.barcode || null,
      expiry_date: form.expiry_date || null,
    };
    const { error } = editing
      ? await supabase.from("medicines").update(payload).eq("id", editing.id)
      : await supabase.from("medicines").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Medicine updated" : "Medicine added");
    setOpen(false);
    load();
  }

  async function remove(m: Medicine) {
    if (!confirm(`Delete ${m.name}?`)) return;
    const { error } = await supabase.from("medicines").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const filtered = items.filter((m) => {
    const s = q.toLowerCase();
    return !s || m.name.toLowerCase().includes(s) || (m.brand ?? "").toLowerCase().includes(s) || (m.category ?? "").toLowerCase().includes(s);
  });

  const today = new Date();
  const soon = new Date(); soon.setDate(soon.getDate() + 60);
  const lowStock = items.filter((m) => m.quantity <= m.reorder_level).length;
  const expiringSoon = items.filter((m) => m.expiry_date && new Date(m.expiry_date) <= soon).length;
  const totalValue = items.reduce((s, m) => s + Number(m.unit_price) * m.quantity, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage your medicine stock</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="size-4 mr-1" /> Add Medicine</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit medicine" : "Add medicine"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field className="col-span-2" label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
              <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Batch #"><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></Field>
              <Field label="Barcode"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
              <Field label="Quantity"><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
              <Field label="Reorder level"><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} /></Field>
              <Field label="Cost price (ETB)"><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} /></Field>
              <Field label="Unit price (ETB)"><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} /></Field>
              <Field className="col-span-2" label="Expiry date"><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Package} label="Total items" value={items.length.toString()} />
        <Stat icon={AlertTriangle} label="Low stock" value={lowStock.toString()} accent={lowStock > 0} />
        <Stat icon={AlertTriangle} label="Expiring < 60d" value={expiringSoon.toString()} accent={expiringSoon > 0} />
        <Stat icon={Package} label="Stock value" value={`ETB ${totalValue.toLocaleString()}`} />
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand, category…" className="pl-9" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Medicine</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Price (ETB)</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No medicines found</td></tr>}
              {filtered.map((m) => {
                const low = m.quantity <= m.reorder_level;
                const expSoon = m.expiry_date && new Date(m.expiry_date) <= soon;
                const expired = m.expiry_date && new Date(m.expiry_date) < today;
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name}</div>
                      {m.brand && <div className="text-xs text-muted-foreground">{m.brand}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.batch_number ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={low ? "text-destructive font-semibold" : ""}>{m.quantity}</span>
                      {low && <Badge variant="destructive" className="ml-2">Low</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(m.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {m.expiry_date ? (
                        <span className={expired ? "text-destructive" : expSoon ? "text-accent-foreground" : ""}>
                          {m.expiry_date}
                          {expired && <Badge variant="destructive" className="ml-2">Expired</Badge>}
                          {!expired && expSoon && <Badge className="ml-2 bg-accent text-accent-foreground">Soon</Badge>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(m)}><Trash2 className="size-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`size-10 rounded-lg grid place-items-center ${accent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold text-lg leading-tight">{value}</div>
      </div>
    </Card>
  );
}
