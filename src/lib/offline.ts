import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QueuedSale = {
  id: string;
  created_at: string;
  items: { medicine_id: string; quantity: number }[];
  payment_method: string;
  cashier_name?: string;
  total: number;
};

const QUEUE_KEY = "offline-sales-queue";
const MEDS_KEY = "offline-medicines-cache";
const EVT = "offline-queue-change";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

export function getQueue(): QueuedSale[] { return read<QueuedSale[]>(QUEUE_KEY, []); }
function setQueue(q: QueuedSale[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event(EVT));
}
export function enqueueSale(s: Omit<QueuedSale, "id" | "created_at">) {
  const sale: QueuedSale = { ...s, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  setQueue([...getQueue(), sale]);
  return sale;
}

export function cacheMedicines<T>(meds: T[]) { localStorage.setItem(MEDS_KEY, JSON.stringify(meds)); }
export function cachedMedicines<T>(): T[] { return read<T[]>(MEDS_KEY, []); }

export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return /failed to fetch|network|load failed/i.test(msg);
}

let syncing = false;
/** Replays queued sales. Returns {synced, failed}. Failed (e.g. out of stock) sales are dropped and reported. */
export async function syncQueue(): Promise<{ synced: number; failed: string[] }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: [] };
  syncing = true;
  let synced = 0; const failed: string[] = [];
  try {
    for (const sale of getQueue()) {
      const { error } = await supabase.rpc("process_sale", {
        _items: sale.items, _payment_method: sale.payment_method, _cashier_name: sale.cashier_name,
      });
      if (error && isNetworkError(error)) break;
      if (error) failed.push(`${new Date(sale.created_at).toLocaleString()}: ${error.message}`);
      else synced++;
      setQueue(getQueue().filter((q) => q.id !== sale.id));
    }
  } finally { syncing = false; }
  return { synced, failed };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); setPending(getQueue().length); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(EVT, update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(EVT, update);
    };
  }, []);
  return { online, pending };
}
