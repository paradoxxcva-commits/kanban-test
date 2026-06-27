import { createFileRoute } from "@tanstack/react-router";

function fmtDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function esc(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export const Route = createFileRoute("/api/public/ical/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const client = supabaseAdmin as any;
        const token = params.token;

        const { data: tok, error: tokErr } = await client
          .from("calendar_tokens")
          .select("user_id, calendar_id, revoked_at")
          .eq("token", token)
          .maybeSingle();
        if (tokErr || !tok || tok.revoked_at) {
          return new Response("Token not found or revoked", { status: 404 });
        }

        const userId = tok.user_id as string;
        const calendarId = tok.calendar_id as string | null;

        const { data: profile } = await client
          .from("profiles")
          .select("org_id")
          .eq("id", userId)
          .maybeSingle();
        const orgId = profile?.org_id as string | null | undefined;

        let calName = "Планка — задачи";

        if (calendarId) {
          const { data: cal } = await client
            .from("calendars")
            .select("name")
            .eq("id", calendarId)
            .maybeSingle();
          if (cal) calName = `Планка — ${cal.name}`;

          const { data: events } = await client
            .from("calendar_events")
            .select("id, title, description, start_time, end_time, all_day, task_id")
            .eq("calendar_id", calendarId)
            .order("start_time", { ascending: true });

          const now = new Date();
          const lines: string[] = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Kanban//Calendar//RU",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${esc(calName)}`,
          ];

          for (const e of events ?? []) {
            const dt = new Date(e.start_time);
            const dtEnd = e.end_time
              ? new Date(e.end_time)
              : e.all_day
                ? new Date(dt.getTime() + 24 * 60 * 60 * 1000)
                : new Date(dt.getTime() + 60 * 60 * 1000);
            lines.push(
              "BEGIN:VEVENT",
              `UID:${e.id}@kanban`,
              `DTSTAMP:${fmtDate(now)}`,
              e.all_day
                ? `DTSTART;VALUE=DATE:${dt.getUTCFullYear().toString()}${(dt.getUTCMonth() + 1).toString().padStart(2, "0")}${dt.getUTCDate().toString().padStart(2, "0")}`
                : `DTSTART:${fmtDate(dt)}`,
              e.all_day
                ? `DTEND;VALUE=DATE:${dtEnd.getUTCFullYear().toString()}${(dtEnd.getUTCMonth() + 1).toString().padStart(2, "0")}${dtEnd.getUTCDate().toString().padStart(2, "0")}`
                : `DTEND:${fmtDate(dtEnd)}`,
              `SUMMARY:${esc(e.title)}`,
              e.description ? `DESCRIPTION:${esc(e.description)}` : "",
              "END:VEVENT",
            );
          }
          lines.push("END:VCALENDAR");

          const body = lines.filter(Boolean).join("\r\n") + "\r\n";
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "text/calendar; charset=utf-8",
              "Cache-Control": "private, max-age=300",
              "Content-Disposition": `inline; filename="${esc(calName)}.ics"`,
            },
          });
        }

        let tasks: Array<{
          id: string;
          title: string;
          description: string | null;
          due_date: string;
          updated_at: string;
        }> = [];

        if (orgId) {
          const { data: boards } = await client
            .from("boards")
            .select("id")
            .eq("org_id", orgId);
          const boardIds = (boards ?? []).map((b: any) => b.id);
          if (boardIds.length) {
            const { data } = await client
              .from("tasks")
              .select("id, title, description, due_date, updated_at")
              .in("board_id", boardIds)
              .not("due_date", "is", null);
            tasks = (data ?? []) as any[];
          }
        }

        const now = new Date();
        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Kanban//Tasks//RU",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${esc(calName)}`,
        ];

        for (const t of tasks) {
          const dt = new Date(t.due_date);
          const dtEnd = new Date(dt.getTime() + 30 * 60 * 1000);
          const upd = t.updated_at ? new Date(t.updated_at) : now;
          lines.push(
            "BEGIN:VEVENT",
            `UID:task-${t.id}@kanban`,
            `DTSTAMP:${fmtDate(upd)}`,
            `DTSTART:${fmtDate(dt)}`,
            `DTEND:${fmtDate(dtEnd)}`,
            `SUMMARY:${esc(t.title)}`,
            t.description ? `DESCRIPTION:${esc(t.description)}` : "",
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        const body = lines.filter(Boolean).join("\r\n") + "\r\n";

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": `inline; filename="${esc(calName)}.ics"`,
          },
        });
      },
    },
  },
});
