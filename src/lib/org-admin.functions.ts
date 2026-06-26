import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureOrgAdmin(ctx: { supabase: any; userId: string }, orgId: string) {
  const { data: isSuper, error: superErr } = await ctx.supabase.rpc("is_super_admin", {
    _user_id: ctx.userId,
  });
  if (superErr) throw new Error(superErr.message);
  if (isSuper) return;

  const { data: isAdmin, error: adminErr } = await ctx.supabase.rpc("is_org_admin", {
    _user_id: ctx.userId,
    _org_id: orgId,
  });
  if (adminErr) throw new Error(adminErr.message);
  if (!isAdmin) throw new Error("Доступ запрещён: требуются права администратора организации.");
}

export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureOrgAdmin(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, is_active, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = (profiles ?? []).map((p: any) => p.id);
    if (userIds.length === 0) return [];

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds)
      .eq("org_id", data.orgId);
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export const inviteOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          orgId: z.string().uuid(),
          email: z.string().email(),
          password: z.string().min(8),
          fullName: z.string().min(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOrgAdmin(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Не удалось создать пользователя");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email: data.email,
      full_name: data.fullName,
      org_id: data.orgId,
      is_active: true,
    });

    await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "user",
      org_id: data.orgId,
    });

    return { id: created.user.id };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOrgAdmin(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ org_id: null })
      .eq("id", data.userId)
      .eq("org_id", data.orgId);
    if (profileErr) throw new Error(profileErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId);
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true };
  });
