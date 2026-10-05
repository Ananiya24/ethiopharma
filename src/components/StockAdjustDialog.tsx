import { useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const REASONS = {
  in: [
    { value: "delivery", label: "New delivery from supplier" },
    { value: "returned", label: "Returned by customer" },
    { value: "correction_in", label: "Count correction (add)" },
  ],
  out: [
    { value: "dispensed", label: "Sold / dispensed" },
    { value: "damaged", label: "Damaged" },
    { value: "expired", label: "Expired — thrown away" },
    { value: "correction_out", label: "Count correction (remove)" },
  ],
} as const;

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  [...REASONS.in, ...REASONS.out].map((r) => [r.value, r.label]),
);

export function StockAdjustDialog({
  medicine, direction, onClose, onDone,
}: {
  medicine: { id: string; name: string; quantity: number } | null;
  direction: "in" | "out";
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<string>(direction === "in" ? "delivery" : "dispensed");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState("");
  const key = `${medicine?.id}-${direction}`;
  if (medicine && key !== lastKey) {
    setLastKey(key); setQty("1"); setNote("");
    setReason(direction === "in" ? "delivery" : "dispensed");
  }

  async function save() {
    if (!medicine) return;
    const n = Math.floor(Number(qty));
    if (!n || n <= 0) return toast.error(t('Enter a quantity above 0'));
    setSaving(true);
    const { data, error } = await supabase.rpc("adjust_stock", { _medicine_id: medicine.id, _quantity: n, _reason: reason, _note: note || undefined });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${medicine.name}: ${direction === "in" ? "+" : "−"}${n} · now ${data} in stock`);
    onDone(); onClose();
  }

  return (
    <Dialog open={!!medicine} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{direction === "in" ? "Stock in" : "Stock out"} — {medicine?.name}</DialogTitle>
          <DialogDescription>Currently {medicine?.quantity ?? 0} in stock.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t('Quantity')}</Label>
            <Input autoFocus inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('Reason')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS[direction].map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t('Note (optional)')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Supplier, invoice no., customer…' )} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
