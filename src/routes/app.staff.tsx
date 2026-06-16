import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { createPharmacist, listStaff, deletePharmacist } from "@/lib/staff.functions";

export const Route = createFileRoute("/app/staff")({
  head: () => ({ meta: [{ title: "Staff — Inventory Management" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    if (data?.role !== "owner") throw redirect({ to: "/app/pos" });
  },
  component: StaffPage,
});

type StaffRow = { user_id: string; email: string; role: "owner" | "pharmacist"; created_at: string };

function StaffPage() {
  const list = useServerFn(listStaff);
  const create = useServerFn(createPharmacist);
  const remove = useServerFn(deletePharmacist);

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await list();
      setRows(data as StaffRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { email, password } });
      toast.success(`Pharmacist account created for ${email}`);
      setEmail(""); setPassword(""); setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(r: StaffRow) {
    if (!confirm(`Delete account ${r.email}? This cannot be undone.`)) return;
    try {
      await remove({ data: { user_id: r.user_id } });
      toast.success("Account deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Users className="size-6" /> Staff accounts</h1>
          <p className="text-sm text-muted-foreground">Create login accounts for your pharmacists. They get inventory + POS access only.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="size-4 mr-1" /> Create pharmacist</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create pharmacist account</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pharmacist@pharmacy.com" />
              </div>
              <div>
                <Label className="text-xs">Temporary password (min 6 chars)</Label>
                <Input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Share this with the pharmacist" />
                <p className="text-[11px] text-muted-foreground mt-1">Give these credentials to your pharmacist. They can sign in immediately.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No accounts yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.role === "owner" ? "default" : "secondary"} className="capitalize">{r.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {r.role !== "owner" && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(r)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
