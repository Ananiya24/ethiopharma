import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/app/activity")({
  head: () => ({ meta: [{ title: "Activity log — Inventory Management" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    if (data?.role !== "owner") throw redirect({ to: "/app/pos" });
  },
  component: ActivityPage,
});

type LogRow = {
  id: string;
  medicine_id: string | null;
  medicine_name: string;
  action: "create" | "update" | "delete";
  user_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const actionStyle = {
  create: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  update: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delete: "bg-destructive/15 text-destructive",
};

function ActivityPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("medicine_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) setRows((data as unknown as LogRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function describe(r: LogRow): string {
    if (r.action === "create") return "added a new medicine";
    if (r.action === "delete") return "deleted the medicine";
    const changes = r.details?.changes as Record<string, { from: unknown; to: unknown }> | undefined;
    if (!changes) return "updated the medicine";
    const parts = Object.entries(changes).map(([k, v]) => `${k}: ${String(v.from)} → ${String(v.to)}`);
    return parts.length ? parts.join(", ") : "updated the medicine";
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Activity className="size-6" /> Activity log</h1>
        <p className="text-sm text-muted-foreground">Who added, edited, or deleted medicines.</p>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Medicine</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge className={`capitalize ${actionStyle[r.action]}`}>{r.action}</Badge></td>
                  <td className="px-4 py-3 font-medium">{r.medicine_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.user_email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{describe(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
