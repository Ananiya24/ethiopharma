import { useLanguage } from "@/lib/i18n";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/staff")({
  head: () => ({ meta: [
    { title: t("Staff — Inventory Management") },
    { name: "description", content: t("Manage pharmacist accounts for your pharmacy.") },
    { property: "og:title", content: t("Staff — Inventory Management") },
    { property: "og:description", content: t("Manage pharmacist accounts for your pharmacy.") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
    if (data?.role !== "owner") throw redirect({ to: "/app/pos" });
  },
  component: StaffPage,
});

type StaffRow = { user_id: string; email: string; role: "owner" | "pharmacist"; created_at: string; confirmed?: boolean };

// Separate client that never stores a session, so signing up a pharmacist doesn't log the owner out.
function signupClient() {
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "staff-signup" },
  });
}

function StaffPage() {
  const { t } = useLanguage();

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("owner_list_staff");
      if (error) throw new Error(error.message);
      setRows((data as unknown as StaffRow[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Failed to load staff"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = email.trim().toLowerCase();
      if (password.length < 6) throw new Error(t('Password must be at least 6 characters'));
      const { data: su, error: suErr } = await signupClient().auth.signUp({
        email: clean, password, options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (suErr) throw new Error(suErr.message);
      const newId = su.user?.id;
      if (!newId || (su.user?.identities && su.user.identities.length === 0)) throw new Error(t('That email is already registered'));
      const { error: rErr } = await supabase.rpc("owner_add_pharmacist", { _user_id: newId, _email: clean });
      if (rErr) throw new Error(rErr.message);
      toast.success(`Account created. ${clean} must confirm their email before signing in.`);
      setEmail(""); setPassword(""); setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Failed to create account"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(r: StaffRow) {
    if (!confirm(`Remove ${r.email} from your pharmacy? They will lose access.`)) return;
    try {
      const { error } = await supabase.rpc("owner_remove_pharmacist", { _user_id: r.user_id });
      if (error) throw new Error(error.message);
      toast.success(t('Access removed'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Failed to delete"));
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2"><Users className="size-6 shrink-0" />{t('Staff accounts')}</h1>
          <p className="text-sm text-muted-foreground">{t('Create login accounts for your pharmacists. They get inventory + POS access only.')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><UserPlus className="size-4 mr-1" />{t('Create pharmacist')}</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader><DialogTitle>{t('Create pharmacist account')}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label className="text-xs">{t('Email')}</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pharmacist@pharmacy.com" />
              </div>
              <div>
                <Label className="text-xs">{t('Temporary password (min 6 chars)')}</Label>
                <Input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('Share this with the pharmacist' )} />
                <p className="text-[11px] text-muted-foreground mt-1">{t('The pharmacist gets a confirmation email and can sign in after clicking the link.')}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
                <Button type="submit" disabled={busy}>{busy ? t("Creating…") : t("Create account")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-secondary/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t('Email')}</th>
                <th className="px-4 py-3 font-medium">{t('Role')}</th>
                <th className="px-4 py-3 font-medium">{t('Created')}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t('Loading…')}</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t('No accounts yet.')}</td></tr>}
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.role === "owner" ? "default" : "secondary"} className="capitalize">{r.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}{r.confirmed === false && <span className="ml-2 text-xs text-amber-600">{t('awaiting email confirmation')}</span>}</td>
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
