import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkCalendarReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any).userId;

    // Get user's reminder preference
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("calendar_reminder_minutes, browser_push")
      .eq("user_id", userId)
      .maybeSingle();

    const minutes = prefs?.calendar_reminder_minutes ?? 15;
    const now = new Date();
    const windowStart = now.toISOString();
    const windowEnd = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

    // Find events starting within the reminder window
    const { data: events } = await supabaseAdmin
      .from("calendar_events")
      .select("id, title, start_time, calendar_id, calendars!inner(org_id, user_id)")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .eq("is_done", false);

    if (!events?.length) return { reminders: [] };

    // Filter events belonging to the user (org member or personal calendar)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();

    const userOrgId = profile?.org_id;
    const relevantEvents = events.filter((e: any) => {
      const cal = e.calendars;
      if (!cal) return false;
      if (cal.user_id === userId) return true; // personal calendar
      if (cal.org_id === userOrgId) return true; // org calendar
      return false;
    });

    // Create notifications for events that don't already have one
    const reminders: { title: string; start_time: string; event_id: string }[] = [];
    for (const ev of relevantEvents) {
      // Check if notification already exists for this event at this time
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "calendar_event" as any)
        .eq("entity_id", ev.id)
        .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existing) continue;

      // Create notification
      await supabaseAdmin.rpc("create_notification", {
        _user_id: userId,
        _org_id: userOrgId,
        _type: "calendar_event" as any,
        _title: "Скоро: " + ev.title,
        _body: "Начало в " + new Date(ev.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        _link: "/calendar",
        _entity_id: ev.id,
      });

      reminders.push({ title: ev.title, start_time: ev.start_time, event_id: ev.id });
    }

    return { reminders };
  });
