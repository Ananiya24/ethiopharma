import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Package, Info } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";

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

// Form uses strings so inputs can be blank (no placeholder "0")
type FormState = {
  name: string;
  brand: string;
  category: string;
  batch_number: string;
  barcode: string;
  quantity: string;
  unit_price: string;
  cost_price: string;
  expiry_date: string;
  reorder_level: string;
};

const emptyForm: FormState = {
  name: "", brand: "", category: "", batch_number: "", barcode: "",
  quantity: "", unit_price: "", cost_price: "", expiry_date: "", reorder_level: "10",
};

function InventoryPage() {
  const { isOwner } = useRole();
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("medicines").select("*").order("name");
    if (error) toast.error(error.message);
    setItems((data as Medicine[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((m) => { if (m.category) set.add(m.category); });
    return [...set].sort();
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(m: Medicine) {
    setEditing(m);
    setForm({
      name: m.name, brand: m.brand ?? "", category: m.category ?? "",
      batch_number: m.batch_number ?? "", barcode: m.barcode ?? "",
      quantity: String(m.quantity),
      unit_price: String(m.unit_price),
      cost_price: String(m.cost_price ?? ""),
      expiry_date: m.expiry_date ?? "",
      reorder_level: String(m.reorder_level),
    });
    setOpen(true);
  }

  async function logActivity(
    action: "create" | "update" | "delete",
    medicineId: string | null,
    medicineName: string,
    details: Record<string, unknown> | null,
  ) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("medicine_activity_log").insert({
      action,
      medicine_id: medicineId,
      medicine_name: medicineName,
      user_id: u.user.id,
      user_email: u.user.email,
      details: details as never,
    });
  }

  async function save() {
    // Required fields
    if (!form.name.trim()) return toast.error("Name is required");
    if (form.quantity === "" || isNaN(Number(form.quantity))) return toast.error("Quantity is required");
    if (form.unit_price === "" || isNaN(Number(form.unit_price))) return toast.error("Unit price is required");
    if (!form.expiry_date) return toast.error("Expiry date is required");

    const quantity = Number(form.quantity);
    const unit_price = Number(form.unit_price);
    const cost_price = form.cost_price === "" ? 0 : Number(form.cost_price);
    const reorder_level = form.reorder_level === "" ? 10 : Number(form.reorder_level);

    if (quantity < 0) return toast.error("Quantity cannot be negative");
    if (unit_price < 0) return toast.error("Unit price cannot be negative");

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        batch_number: form.batch_number.trim() || null,
        barcode: form.barcode.trim() || null,
        quantity,
        unit_price,
        expiry_date: form.expiry_date,
        reorder_level,
        ...(isOwner ? { cost_price } : {}),
      };

      if (editing) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        (Object.keys(payload) as Array<keyof typeof payload>).forEach((k) => {
          const newV = (payload as Record<string, unknown>)[k as string];
          const oldV = (editing as unknown as Record<string, unknown>)[k as string];
          if (String(newV ?? "") !== String(oldV ?? "")) changes[k as string] = { from: oldV, to: newV };
        });
        const { error } = await supabase.from("medicines").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logActivity("update", editing.id, payload.name, { changes });
        toast.success("Medicine updated");
      } else {
        const { data, error } = await supabase.from("medicines").insert(payload).select("id").single();
        if (error) throw error;
        await logActivity("create", data?.id ?? null, payload.name, { values: payload as Record<string, unknown> });
        toast.success("Medicine added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Medicine) {
    if (!confirm(`Delete ${m.name}?`)) return;
    const { error } = await supabase.from("medicines").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logActivity("delete", m.id, m.name, null);
    toast.success("Deleted");
    load();
  }

  const filtered = items.filter((m) => {
    const s = q.toLowerCase();
    const matchesQ = !s || m.name.toLowerCase().includes(s) || (m.brand ?? "").toLowerCase().includes(s) || (m.batch_number ?? "").toLowerCase().includes(s);
    const matchesCat = categoryFilter === "all" || (m.category ?? "") === categoryFilter;
    return matchesQ && matchesCat;
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit medicine" : "Add medicine"}</DialogTitle>
              <DialogDescription>Fields marked * are required.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field className="col-span-2" label="Name *">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amoxicillin 500mg" />
              </Field>
              <Field label="Brand">
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="" />
              </Field>
              <Field label="Category">
                {categories.length > 0 ? (
                  <Select value={form.category || "__new__"} onValueChange={(v) => setForm({ ...form, category: v === "__new__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select or type" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value="__new__">+ New category…</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Antibiotic" />
                )}
                {categories.length > 0 && (!form.category || !categories.includes(form.category)) && (
                  <Input className="mt-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Type new category name" />
                )}
              </Field>
              <Field label="Batch #">
                <Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
              </Field>
              <Field label="Barcode">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </Field>
              <Field label="Quantity *">
                <Input type="number" inputMode="numeric" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="" />
              </Field>
              <Field
                label="Reorder level"
                hint="Alert me when stock drops to this number. Helps you reorder before running out."
              >
                <Input type="number" inputMode="numeric" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </Field>
              {isOwner && (
                <Field label="Cost price (ETB)" hint="What you pay the supplier. Used to calculate profit. Owner-only.">
                  <Input type="number" step="0.01" inputMode="decimal" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="" />
                </Field>
              )}
              <Field label="Unit price (ETB) *" className={isOwner ? "" : "col-span-2"}>
                <Input type="number" step="0.01" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="" />
              </Field>
              <Field className="col-span-2" label="Expiry date *">
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats — pharmacists don't see stock value (money) */}
      <div className={`grid gap-4 mb-6 grid-cols-2 ${isOwner ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Stat icon={Package} label="Total items" value={items.length.toString()} />
        <Stat icon={AlertTriangle} label="Low stock" value={lowStock.toString()} accent={lowStock > 0} />
        <Stat icon={AlertTriangle} label="Expiring < 60d" value={expiringSoon.toString()} accent={expiringSoon > 0} />
        {isOwner && <Stat icon={Package} label="Stock value" value={`ETB ${totalValue.toLocaleString()}`} />}
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand, batch…" className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
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

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        {label}
        {hint && <span title={hint} className="inline-flex"><Info className="size-3" /></span>}
      </Label>
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
