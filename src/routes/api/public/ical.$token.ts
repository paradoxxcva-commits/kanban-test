import { createFileRoute } from "@tanstack/react-router";

function fmtDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ
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
        const token = params.token;

        const { data: tok, error: tokErr } = await supabaseAdmin
          .from("calendar_tokens")
          .select("user_id, revoked_at")
          .eq("token", token)
          .maybeSingle();
        if (tokErr || !tok || tok.revoked_at) {
          return new Response("Token not found or revoked", { status: 404 });
        }

        const userId = tok.user_id as string;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("org_id")
          .eq("id", userId)
          .maybeSingle();
        const orgId = profile?.org_id as string | null | undefined;

        let tasks: Array<{
          id: string;
          title: string;
          description: string | null;
          due_date: string;
          board_id: string;
          updated_at: string;
        }> = [];

        if (orgId) {
          const { data: boards } = await supabaseAdmin
            .from("boards")
            .select("id")
            .eq("org_id", orgId);
          const boardIds = (boards ?? []).map((b: any) => b.id);
          if (boardIds.length) {
            const { data } = await supabaseAdmin
              .from("tasks")
              .select("id, title, description, due_date, board_id, updated_at")
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
          `X-WR-CALNAME:${esc("Канбан — задачи")}`,
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
            "Content-Disposition": 'inline; filename="kanban.ics"',
          },
        });
      },
    },
  },
});
