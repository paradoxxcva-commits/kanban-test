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

export const createBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          orgId: z.string().uuid(),
          name: z.string().min(1),
          description: z.string().optional(),
          color: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOrgAdmin(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: board, error } = await supabaseAdmin
      .from("boards")
      .insert({
        org_id: data.orgId,
        name: data.name,
        description: data.description,
        color: data.color,
        created_by: (context as any).userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return board;
  });

export const deleteBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ boardId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: board, error: fetchErr } = await supabaseAdmin
      .from("boards")
      .select("org_id")
      .eq("id", data.boardId)
      .single();
    if (fetchErr || !board) throw new Error("Доска не найдена");
    await ensureOrgAdmin(context as any, board.org_id);
    const { error } = await supabaseAdmin.from("boards").delete().eq("id", data.boardId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createColumn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          boardId: z.string().uuid(),
          name: z.string().min(1),
          position: z.number().int().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: board, error: fetchErr } = await supabaseAdmin
      .from("boards")
      .select("org_id")
      .eq("id", data.boardId)
      .single();
    if (fetchErr || !board) throw new Error("Доска не найдена");
    await ensureOrgAdmin(context as any, board.org_id);
    const { data: col, error } = await supabaseAdmin
      .from("board_columns")
      .insert({
        board_id: data.boardId,
        name: data.name,
        position: data.position ?? 0,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return col;
  });

export const deleteColumn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ columnId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: col, error: fetchErr } = await supabaseAdmin
      .from("board_columns")
      .select("board_id, boards!inner(org_id)")
      .eq("id", data.columnId)
      .single();
    if (fetchErr || !col) throw new Error("Колонка не найдена");
    const orgId = (col as any).boards?.org_id;
    if (!orgId) throw new Error("Не удалось определить организацию доски");
    await ensureOrgAdmin(context as any, orgId);
    const { error } = await supabaseAdmin.from("board_columns").delete().eq("id", data.columnId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameColumn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          columnId: z.string().uuid(),
          name: z.string().min(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: col, error: fetchErr } = await supabaseAdmin
      .from("board_columns")
      .select("board_id, boards!inner(org_id)")
      .eq("id", data.columnId)
      .single();
    if (fetchErr || !col) throw new Error("Колонка не найдена");
    const orgId = (col as any).boards?.org_id;
    if (!orgId) throw new Error("Не удалось определить организацию доски");
    await ensureOrgAdmin(context as any, orgId);
    const { error } = await supabaseAdmin
      .from("board_columns")
      .update({ name: data.name })
      .eq("id", data.columnId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("board_id, boards!inner(org_id)")
      .eq("id", data.taskId)
      .single();
    if (fetchErr || !task) throw new Error("Задача не найдена");
    const orgId = (task as any).boards?.org_id;
    if (!orgId) throw new Error("Не удалось определить организацию доски");
    await ensureOrgAdmin(context as any, orgId);
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unarchiveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("board_id, boards!inner(org_id)")
      .eq("id", data.taskId)
      .single();
    if (fetchErr || !task) throw new Error("Задача не найдена");
    const orgId = (task as any).boards?.org_id;
    if (!orgId) throw new Error("Не удалось определить организацию доски");
    await ensureOrgAdmin(context as any, orgId);
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ archived_at: null })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
