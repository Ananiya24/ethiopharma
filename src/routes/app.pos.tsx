import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, Trash2, ShoppingCart, Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/pos")({
  head: () => ({ meta: [{ title: "POS — Inventory Management" }] }),
  component: POSPage,
});

type Medicine = {
  id: string; name: string; brand: string | null; quantity: number; unit_price: number; category: string | null;
};

type CartItem = { medicine: Medicine; qty: number };

function POSPage() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("cash");
  const [cashier, setCashier] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ saleNumber: string; total: number; items: CartItem[] } | null>(null);

  async function load() {
    const { data } = await supabase.from("medicines").select("id,name,brand,quantity,unit_price,category").gt("quantity", 0).order("name");
    setMeds((data as Medicine[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return meds.filter((m) => !s || m.name.toLowerCase().includes(s) || (m.brand ?? "").toLowerCase().includes(s));
  }, [meds, q]);

  function addToCart(m: Medicine) {
    setCart((c) => {
      const existing = c.find((i) => i.medicine.id === m.id);
      if (existing) {
        if (existing.qty >= m.quantity) { toast.error("Not enough stock"); return c; }
        return c.map((i) => i.medicine.id === m.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...c, { medicine: m, qty: 1 }];
    });
  }
  function updateQty(id: string, delta: number) {
    setCart((c) => c.flatMap((i) => {
      if (i.medicine.id !== id) return [i];
      const next = i.qty + delta;
      if (next <= 0) return [];
      if (next > i.medicine.quantity) { toast.error("Not enough stock"); return [i]; }
      return [{ ...i, qty: next }];
    }));
  }
  function removeFromCart(id: string) { setCart((c) => c.filter((i) => i.medicine.id !== id)); }

  const total = cart.reduce((s, i) => s + i.qty * Number(i.medicine.unit_price), 0);

  async function checkout() {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const saleNumber = `S-${Date.now().toString().slice(-8)}`;
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({ sale_number: saleNumber, total_amount: total, payment_method: payment, cashier_name: cashier || null })
        .select().single();
      if (saleErr || !sale) throw saleErr ?? new Error("Sale failed");

      const items = cart.map((i) => ({
        sale_id: sale.id,
        medicine_id: i.medicine.id,
        medicine_name: i.medicine.name,
        quantity: i.qty,
        unit_price: Number(i.medicine.unit_price),
        subtotal: i.qty * Number(i.medicine.unit_price),
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Decrement stock
      await Promise.all(cart.map((i) =>
        supabase.from("medicines").update({ quantity: i.medicine.quantity - i.qty }).eq("id", i.medicine.id)
      ));

      setLastReceipt({ saleNumber, total, items: [...cart] });
      setCart([]);
      setCashier("");
      load();
      toast.success("Sale completed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 grid lg:grid-cols-[1fr_400px] gap-6 max-w-[1600px] mx-auto">
      {/* Products */}
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">Tap a medicine to add it to the cart</p>
          </div>
        </div>
        <div className="relative mb-4">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicines or scan barcode…" className="pl-9 h-11" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((m) => (
            <button key={m.id} onClick={() => addToCart(m)} className="text-left">
              <Card className="p-4 hover:border-primary hover:shadow-[var(--shadow-card)] transition-all cursor-pointer h-full">
                <div className="text-xs text-primary font-medium">{m.category ?? "Medicine"}</div>
                <div className="font-semibold mt-1 line-clamp-2">{m.name}</div>
                {m.brand && <div className="text-xs text-muted-foreground">{m.brand}</div>}
                <div className="mt-3 flex items-end justify-between">
                  <div className="font-bold text-lg">ETB {Number(m.unit_price).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{m.quantity} in stock</div>
                </div>
              </Card>
            </button>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No medicines available</div>}
        </div>
      </div>

      {/* Cart */}
      <Card className="p-5 lg:sticky lg:top-4 self-start max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="size-5 text-primary" />
          <h2 className="font-bold text-lg">Current Sale</h2>
          {cart.length > 0 && <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{cart.length} items</span>}
        </div>
        <div className="flex-1 overflow-y-auto -mx-2 px-2 min-h-[100px]">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-10 text-sm">Cart is empty</div>
          )}
          {cart.map((i) => (
            <div key={i.medicine.id} className="flex items-start gap-2 py-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{i.medicine.name}</div>
                <div className="text-xs text-muted-foreground">ETB {Number(i.medicine.unit_price).toFixed(2)} × {i.qty}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(i.medicine.id, -1)}><Minus className="size-3" /></Button>
                <span className="w-6 text-center text-sm font-medium">{i.qty}</span>
                <Button size="icon" variant="outline" className="size-7" onClick={() => updateQty(i.medicine.id, 1)}><Plus className="size-3" /></Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => removeFromCart(i.medicine.id)}><Trash2 className="size-3 text-destructive" /></Button>
              </div>
              <div className="font-semibold text-sm w-20 text-right">{(i.qty * Number(i.medicine.unit_price)).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Cashier name" value={cashier} onChange={(e) => setCashier(e.target.value)} />
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="telebirr">Telebirr</SelectItem>
                <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-3xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              ETB {total.toFixed(2)}
            </span>
          </div>
          <Button className="w-full h-12 text-base" disabled={cart.length === 0 || processing} onClick={checkout}>
            <Receipt className="size-5 mr-2" /> {processing ? "Processing…" : "Complete Sale"}
          </Button>
        </div>
      </Card>

      {/* Receipt overlay */}
      {lastReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setLastReceipt(null)}>
          <Card className="max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="size-12 mx-auto rounded-full bg-primary/10 text-primary grid place-items-center mb-2">
                <CheckCircle2 className="size-7" />
              </div>
              <h3 className="font-bold text-lg">Sale Completed</h3>
              <div className="text-xs text-muted-foreground">Inventory Management · {lastReceipt.saleNumber}</div>
            </div>
            <div className="border-t border-dashed border-border pt-3 space-y-1.5 text-sm">
              {lastReceipt.items.map((i) => (
                <div key={i.medicine.id} className="flex justify-between gap-2">
                  <span className="truncate">{i.medicine.name} × {i.qty}</span>
                  <span>{(i.qty * Number(i.medicine.unit_price)).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-border mt-3 pt-3 flex justify-between font-bold text-lg">
              <span>Total</span><span>ETB {lastReceipt.total.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>Print</Button>
              <Button className="flex-1" onClick={() => setLastReceipt(null)}>New Sale</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
