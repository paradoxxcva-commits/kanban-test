import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import {
  listCalendars,
  createCalendar,
  deleteCalendar,
  listCalendarEvents,
  createCalendarEvent,
  sendTaskToCalendar,
  removeTaskFromCalendar,
  getTaskCalendarStatus,
} from "@/lib/calendar.functions";
import { listBoards, listColumns, type ColumnRow } from "@/lib/boards-api";
import { TaskDialog } from "@/components/boards/task-dialog";
import type { TaskRow } from "@/lib/boards-api";
import { useAuth } from "@/lib/auth-context";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Trash2,
  X,
  Loader2,
  Check,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Календарь — Планка" }] }),
  component: CalendarPage,
});

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const CALENDAR_COLORS = [
  { name: "Бренд", value: "brand" },
  { name: "Голубой", value: "sky" },
  { name: "Зелёный", value: "emerald" },
  { name: "Фиолетовый", value: "violet" },
  { name: "Розовый", value: "rose" },
  { name: "Жёлтый", value: "amber" },
];

const COLOR_MAP: Record<string, string> = {
  brand: "bg-brand",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function startOfGrid(d: Date) {
  const s = startOfMonth(d);
  const dow = (s.getDay() + 6) % 7;
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - dow);
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarPage() {
  const { profile, hasRole } = useAuth();
  const canManageCalendars = hasRole("admin") || hasRole("super_admin");
  const qc = useQueryClient();

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set());
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [sendTaskOpen, setSendTaskOpen] = useState(false);
  const [taskToSend, setTaskToSend] = useState<TaskRow | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [createBoardId, setCreateBoardId] = useState<string>("");
  const [createColumns, setCreateColumns] = useState<ColumnRow[]>([]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfGrid(cursor);
  const gridEnd = addDays(gridStart, 42);

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  // Fetch calendars
  const calendarsQ = useQuery({
    queryKey: ["calendars", profile?.org_id],
    queryFn: () => listCalendars({ data: { orgId: profile!.org_id! } }),
    enabled: !!profile?.org_id,
  });

  // Initialize selected calendars
  useMemo(() => {
    if (calendarsQ.data && selectedCalendars.size === 0) {
      setSelectedCalendars(new Set(calendarsQ.data.map((c: any) => c.id)));
    }
  }, [calendarsQ.data]);

  // Fetch events for selected calendars
  const eventsQ = useQuery({
    queryKey: ["calendar-events", Array.from(selectedCalendars), gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: () =>
      listCalendarEvents({
        data: {
          calendarIds: Array.from(selectedCalendars),
          start: gridStart.toISOString(),
          end: gridEnd.toISOString(),
        },
      }),
    enabled: selectedCalendars.size > 0,
  });

  // Fetch tasks with due dates
  const tasksQ = useQuery({
    queryKey: ["calendar-tasks", gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .not("due_date", "is", null)
        .gte("due_date", gridStart.toISOString())
        .lte("due_date", gridEnd.toISOString());
      return (data ?? []) as TaskRow[];
    },
  });

  const boardsQ = useQuery({ queryKey: ["boards"], queryFn: () => listBoards() });

  // Merge events and tasks by day
  const itemsByDay = useMemo(() => {
    const map = new Map<string, { events: any[]; tasks: TaskRow[] }>();

    for (const e of eventsQ.data ?? []) {
      const d = new Date(e.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { events: [], tasks: [] });
      map.get(key)!.events.push(e);
    }

    for (const t of tasksQ.data ?? []) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { events: [], tasks: [] });
      map.get(key)!.tasks.push(t);
    }

    return map;
  }, [eventsQ.data, tasksQ.data]);

  const toggleCalendar = (id: string) => {
    setSelectedCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateForDay = (day: Date) => {
    setCreateEventOpen(true);
  };

  const openEditTask = async (t: TaskRow) => {
    const cols = await listColumns(t.board_id);
    setCreateBoardId(t.board_id);
    setCreateColumns(cols);
    setEditingTask(t);
    setTaskOpen(true);
  };

  const openSendToCalendar = (t: TaskRow) => {
    setTaskToSend(t);
    setSendTaskOpen(true);
  };

  const monthLabel = cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-4 p-6 lg:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Календарь
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground capitalize">
              {monthLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="ring-focus rounded-md border border-border bg-surface p-2 hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="ring-focus rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent"
            >
              Сегодня
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="ring-focus rounded-md border border-border bg-surface p-2 hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" onClick={() => setCreateEventOpen(true)}>
              <Plus className="h-4 w-4" /> Событие
            </Button>
            {canManageCalendars && (
              <Button variant="outline" size="sm" onClick={() => setCreateCalendarOpen(true)}>
                <CalendarDays className="h-4 w-4" /> Календарь
              </Button>
            )}
          </div>
        </header>

        <div className="flex gap-4">
          {/* Sidebar: Calendar list */}
          <div className="w-48 shrink-0 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Календари
            </div>
            {calendarsQ.data?.map((cal: any) => (
              <label
                key={cal.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedCalendars.has(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="h-4 w-4 accent-[color:var(--brand)]"
                />
                <span
                  className={`h-3 w-3 rounded-full ${COLOR_MAP[cal.color ?? "brand"] ?? COLOR_MAP.brand}`}
                />
                <span className="flex-1 truncate text-foreground">{cal.name}</span>
                {canManageCalendars && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Удалить календарь «${cal.name}»?`)) {
                        deleteCalendar({ data: { calendarId: cal.id } }).then(() => calendarsQ.refetch());
                      }
                    }}
                    className="opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </label>
            ))}
            {calendarsQ.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">Нет календарей</p>
            )}
          </div>

          {/* Calendar grid */}
          <div className="flex-1 surface-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-surface">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const inMonth = day >= monthStart && day < monthEnd;
                const isToday = sameDay(day, new Date());
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const items = itemsByDay.get(key) ?? { events: [], tasks: [] };
                return (
                  <div
                    key={idx}
                    className={`group relative min-h-[110px] border-b border-r border-border p-1.5 ${
                      inMonth ? "bg-background" : "bg-surface/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                          isToday
                            ? "bg-brand font-semibold text-brand-foreground"
                            : inMonth
                              ? "text-foreground"
                              : "text-muted-foreground/60"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {/* Calendar events */}
                      {items.events.slice(0, 2).map((e) => {
                        const cal = calendarsQ.data?.find((c: any) => c.id === e.calendar_id);
                        return (
                          <div
                            key={e.id}
                            className={`flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] text-white ${COLOR_MAP[cal?.color ?? "brand"] ?? COLOR_MAP.brand}`}
                            title={e.title}
                          >
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.title}</span>
                          </div>
                        );
                      })}
                      {/* Tasks */}
                      {items.tasks.slice(0, 2).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => openEditTask(t)}
                          className="flex w-full items-center gap-1.5 truncate rounded bg-accent/60 px-1.5 py-1 text-left text-[11px] text-foreground hover:bg-accent"
                          title={t.title}
                        >
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                      {(items.events.length + items.tasks.length) > 4 && (
                        <div className="px-1.5 text-[10px] text-muted-foreground">
                          + ещё {(items.events.length + items.tasks.length) - 4}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Create Event Dialog */}
      {createEventOpen && (
        <CreateEventDialog
          calendars={calendarsQ.data ?? []}
          defaultDate={new Date()}
          onClose={() => setCreateEventOpen(false)}
          onCreated={() => {
            setCreateEventOpen(false);
            eventsQ.refetch();
          }}
        />
      )}

      {/* Create Calendar Dialog */}
      {createCalendarOpen && (
        <CreateCalendarDialog
          orgId={profile?.org_id!}
          onClose={() => setCreateCalendarOpen(false)}
          onCreated={() => {
            setCreateCalendarOpen(false);
            calendarsQ.refetch();
          }}
        />
      )}

      {/* Send Task to Calendar Dialog */}
      {sendTaskOpen && taskToSend && (
        <SendTaskToCalendarDialog
          task={taskToSend}
          calendars={calendarsQ.data ?? []}
          onClose={() => {
            setSendTaskOpen(false);
            setTaskToSend(null);
          }}
          onSent={() => {
            setSendTaskOpen(false);
            setTaskToSend(null);
            eventsQ.refetch();
          }}
        />
      )}

      {/* Task Dialog */}
      {taskOpen && createColumns.length > 0 && (
        <TaskDialog
          open={taskOpen}
          onOpenChange={(v) => {
            setTaskOpen(v);
            if (!v) {
              tasksQ.refetch();
              setEditingTask(null);
            }
          }}
          boardId={createBoardId}
          columns={createColumns}
          initialColumnId={createColumns[0]?.id}
          task={editingTask}
          key={(editingTask?.id ?? "new")}
        />
      )}
    </AppShell>
  );
}

function CreateEventDialog({
  calendars,
  defaultDate,
  onClose,
  onCreated,
}: {
  calendars: any[];
  defaultDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createEvent = useServerFn(createCalendarEvent);
  const [form, setForm] = useState({
    calendarId: calendars[0]?.id ?? "",
    title: "",
    description: "",
    startTime: defaultDate.toISOString().slice(0, 16),
    endTime: "",
    allDay: false,
  });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.calendarId) return toast.error("Выберите календарь");
    setBusy(true);
    try {
      await createEvent({
        data: {
          calendarId: form.calendarId,
          title: form.title,
          description: form.description || undefined,
          startTime: form.allDay
            ? new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate()).toISOString()
            : new Date(form.startTime).toISOString(),
          endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
          allDay: form.allDay,
        },
      });
      toast.success("Событие создано");
      onCreated();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новое событие</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Календарь</div>
            <select
              value={form.calendarId}
              onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {calendars.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Название</div>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Название события"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Описание</div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-foreground">Весь день</span>
          </div>
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Начало</div>
                <input
                  type="datetime-local"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Конец</div>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateCalendarDialog({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createCal = useServerFn(createCalendar);
  const [form, setForm] = useState({ name: "", color: "brand" });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createCal({ data: { orgId, name: form.name, color: form.color } });
      toast.success("Календарь создан");
      onCreated();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый календарь</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Название</div>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например: Служба продаж"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Цвет</div>
            <div className="flex gap-2">
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full ${COLOR_MAP[c.value]} ${
                    form.color === c.value ? "ring-2 ring-offset-2 ring-brand" : ""
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SendTaskToCalendarDialog({
  task,
  calendars,
  onClose,
  onSent,
}: {
  task: TaskRow;
  calendars: any[];
  onClose: () => void;
  onSent: () => void;
}) {
  const sendTask = useServerFn(sendTaskToCalendar);
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const onSend = async () => {
    if (!calendarId) return toast.error("Выберите календарь");
    setBusy(true);
    try {
      await sendTask({ data: { taskId: task.id, calendarId } });
      toast.success("Задание отправлено в календарь");
      onSent();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отправить в календарь</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Задание: <span className="font-semibold">{task.title}</span>
          </p>
          {task.due_date && (
            <p className="text-xs text-muted-foreground">
              Дедлайн: {new Date(task.due_date).toLocaleDateString("ru-RU")}
            </p>
          )}
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Календарь</div>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {calendars.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button onClick={onSend} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              Отправить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
