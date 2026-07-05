import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Bypass generated types for new tables (calendars, calendar_events)
// These will be properly typed after running `supabase gen types`
type AnyClient = any;

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

// ============ CALENDARS ============

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    // Fetch org calendars + user's personal calendars
    const { data: calendars, error } = await client
      .from("calendars")
      .select("id, name, color, created_at, created_by, user_id")
      .or(`and(org_id.eq.${data.orgId},user_id.is.null),and(org_id.eq.${data.orgId},user_id.eq.${(context as any).userId})`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return calendars;
  });

export const createCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          orgId: z.string().uuid(),
          name: z.string().min(1),
          color: z.string().optional(),
          personal: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Personal calendars: any user can create in their org
    // Org calendars: admin+ only
    if (!data.personal) {
      await ensureOrgAdmin(context as any, data.orgId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { data: calendar, error } = await client
      .from("calendars")
      .insert({
        org_id: data.orgId,
        name: data.name,
        color: data.color,
        created_by: (context as any).userId,
        user_id: data.personal ? (context as any).userId : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return calendar;
  });

export const deleteCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ calendarId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { data: cal, error: fetchErr } = await client
      .from("calendars")
      .select("org_id, user_id")
      .eq("id", data.calendarId)
      .single();
    if (fetchErr || !cal) throw new Error("Календарь не найден");
    const isOwner = cal.user_id === (context as any).userId;
    if (!isOwner) {
      await ensureOrgAdmin(context as any, cal.org_id);
    }
    const { error } = await client.from("calendars").delete().eq("id", data.calendarId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CALENDAR EVENTS ============

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          calendarIds: z.array(z.string().uuid()),
          start: z.string(),
          end: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { data: events, error } = await client
      .from("calendar_events")
      .select("id, calendar_id, task_id, title, description, start_time, end_time, all_day, created_by, is_done")
      .in("calendar_id", data.calendarIds)
      .gte("start_time", data.start)
      .lte("start_time", data.end)
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return events;
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          calendarId: z.string().uuid(),
          title: z.string().min(1),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          allDay: z.boolean().optional(),
          taskId: z.string().uuid().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { data: event, error } = await client
      .from("calendar_events")
      .insert({
        calendar_id: data.calendarId,
        task_id: data.taskId,
        title: data.title,
        description: data.description,
        start_time: data.startTime,
        end_time: data.endTime,
        all_day: data.allDay ?? false,
        created_by: (context as any).userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return event;
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          eventId: z.string().uuid(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          allDay: z.boolean().optional(),
          isDone: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const updates: Record<string, any> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.startTime !== undefined) updates.start_time = data.startTime;
    if (data.endTime !== undefined) updates.end_time = data.endTime;
    if (data.allDay !== undefined) updates.all_day = data.allDay;
    if (data.isDone !== undefined) updates.is_done = data.isDone;
    if (data.isDone !== undefined) updates.is_done = data.isDone;

    const { error } = await client
      .from("calendar_events")
      .update(updates)
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { error } = await client.from("calendar_events").delete().eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ SEND TASK TO CALENDAR ============

export const sendTaskToCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          taskId: z.string().uuid(),
          calendarId: z.string().uuid(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;

    // Fetch task details
    const { data: task, error: taskErr } = await client
      .from("tasks")
      .select("id, title, description, due_date, completed_at")
      .eq("id", data.taskId)
      .single();
    if (taskErr || !task) throw new Error("Задание не найдено");

    // Check if already sent to this calendar
    const { data: existing } = await client
      .from("calendar_events")
      .select("id")
      .eq("task_id", data.taskId)
      .eq("calendar_id", data.calendarId)
      .maybeSingle();
    if (existing) throw new Error("Задание уже отправлено в этот календарь");

    // Create event from task
    const startTime = task.due_date || new Date().toISOString();
    const { data: event, error: insErr } = await client
      .from("calendar_events")
      .insert({
        calendar_id: data.calendarId,
        task_id: data.taskId,
        title: task.title,
        description: task.description,
        start_time: startTime,
        all_day: !task.due_date,
        created_by: (context as any).userId,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    return event;
  });

export const removeTaskFromCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      z
        .object({
          taskId: z.string().uuid(),
          calendarId: z.string().uuid(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { error } = await client
      .from("calendar_events")
      .delete()
      .eq("task_id", data.taskId)
      .eq("calendar_id", data.calendarId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTaskCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as AnyClient;
    const { data: events, error } = await client
      .from("calendar_events")
      .select("id, calendar_id, calendars(name)")
      .eq("task_id", data.taskId);
    if (error) throw new Error(error.message);
    return events ?? [];
  });
