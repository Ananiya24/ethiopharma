import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreatePharmacistInput = { email: string; password: string };

function isCreatePharmacistInput(v: unknown): v is CreatePharmacistInput {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.email === "string" && typeof o.password === "string";
}

export const createPharmacist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): CreatePharmacistInput => {
    if (!isCreatePharmacistInput(input)) throw new Error("Invalid input");
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters");
    return { email, password: input.password };
  })
  .handler(async ({ data, context }) => {
    // Verify caller is owner
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Forbidden: only the owner can create accounts");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr) throw new Error(createErr.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Failed to create user");

    const { error: insertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "pharmacist" });
    if (insertErr) {
      // Rollback the auth user if role insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(insertErr.message);
    }
    return { id: newUserId, email: data.email };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: usersList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
    if (usersErr) throw new Error(usersErr.message);
    const emailMap = new Map(usersList.users.map((u) => [u.id, u.email ?? ""]));

    return (roles ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role as "owner" | "pharmacist",
      created_at: r.created_at,
      email: emailMap.get(r.user_id) ?? "(unknown)",
    }));
  });

type DeleteInput = { user_id: string };
export const deletePharmacist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): DeleteInput => {
    if (!input || typeof input !== "object" || typeof (input as { user_id?: unknown }).user_id !== "string") {
      throw new Error("Invalid input");
    }
    return { user_id: (input as { user_id: string }).user_id };
  })
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");
    if (data.user_id === context.userId) throw new Error("You cannot delete yourself");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Block deleting another owner
    const { data: target } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (target?.role === "owner") throw new Error("Cannot delete an owner account");

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
