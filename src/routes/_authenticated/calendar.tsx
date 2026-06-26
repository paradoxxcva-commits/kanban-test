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
  updateCalendarEvent,
  deleteCalendarEvent,
  sendTaskToCalendar,
  removeTaskFromCalendar,
  getTaskCalendarStatus,
} from "@/lib/calendar.functions";
import { listBoards, listColumns, type ColumnRow } from "@/lib/boards-api";
import { TaskDialog } from "@/components/boards/task-dialog";
import type { TaskRow } from "@/lib/boards-api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
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
  Link2,
  Copy,
  RotateCcw,
  Pencil,
  KanbanSquare,
} from "lucide-react";
import { getOrCreateCalendarToken, revokeCalendarToken, getActiveCalendarToken } from "@/lib/calendar-api";
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
  const { profile, user, hasRole } = useAuth();
  const canManageCalendars = hasRole("admin") || hasRole("super_admin");
  const qc = useQueryClient();

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set());
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [icalOpen, setIcalOpen] = useState(false);
  const [sendTaskOpen, setSendTaskOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
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
    try {
      const cols = await listColumns(t.board_id);
      if (!cols || cols.length === 0) {
        toast.error("В доске нет колонок");
        return;
      }
      setCreateBoardId(t.board_id);
      setCreateColumns(cols);
      setEditingTask(t);
      setTaskOpen(true);
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
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
            <Button variant="outline" size="sm" onClick={() => setIcalOpen(true)}>
              <Link2 className="h-4 w-4" /> iCal
            </Button>
            {canManageCalendars && profile?.org_id && (
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
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const eventId = e.dataTransfer.getData("event-id");
                      const taskId = e.dataTransfer.getData("task-id");
                      if (eventId) {
                        const ev = (eventsQ.data ?? []).find((x: any) => x.id === eventId);
                        const oldTime = ev ? new Date(ev.start_time) : new Date();
                        const hours = oldTime.getHours();
                        const minutes = oldTime.getMinutes();
                        const newStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
                        updateCalendarEvent({
                          data: {
                            eventId,
                            startTime: newStart.toISOString(),
                          },
                        }).then(() => eventsQ.refetch());
                      } else if (taskId) {
                        const newDue = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0).toISOString();
                        supabase.from("tasks").update({ due_date: newDue }).eq("id", taskId).then(() => tasksQ.refetch());
                      }
                    }}
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
                          <button
                            key={e.id}
                            draggable
                            onDragStart={(ev) => {
                              ev.dataTransfer.setData("event-id", e.id);
                              ev.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => setSelectedEvent(e)}
                            className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] text-white cursor-grab active:cursor-grabbing ${COLOR_MAP[cal?.color ?? "brand"] ?? COLOR_MAP.brand}`}
                            title={e.title}
                          >
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.title}</span>
                          </button>
                        );
                      })}
                      {/* Tasks from kanban boards */}
                      {items.tasks.slice(0, 2).map((t) => (
                        <button
                          key={t.id}
                          draggable
                          onDragStart={(ev) => {
                            ev.dataTransfer.setData("task-id", t.id);
                            ev.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => openEditTask(t)}
                          className="flex w-full items-center gap-1.5 truncate rounded bg-sky-500/80 px-1.5 py-1 text-left text-[11px] text-white hover:bg-sky-500 cursor-grab active:cursor-grabbing"
                          title={t.title}
                        >
                          <KanbanSquare className="h-3 w-3 shrink-0" />
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

      {/* iCal Dialog */}
      <IcalDialog open={icalOpen} onOpenChange={setIcalOpen} userId={user?.id ?? null} />

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          calendars={calendarsQ.data ?? []}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => {
            setSelectedEvent(null);
            eventsQ.refetch();
          }}
          onDeleted={() => {
            setSelectedEvent(null);
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

function IcalDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string | null }) {
  const tokenQ = useQuery({
    queryKey: ["calendar-token", userId],
    queryFn: () => (userId ? getActiveCalendarToken(userId) : Promise.resolve(null)),
    enabled: !!userId && open,
  });

  const onCreate = async () => {
    if (!userId) return;
    await getOrCreateCalendarToken(userId);
    tokenQ.refetch();
  };
  const onRevoke = async () => {
    if (!tokenQ.data) return;
    if (!confirm("Сбросить текущий токен? Старая ссылка перестанет работать.")) return;
    await revokeCalendarToken(tokenQ.data.id);
    tokenQ.refetch();
  };

  const url = tokenQ.data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/ical/${tokenQ.data.token}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>iCal-фид</DialogTitle>
        </DialogHeader>
        {tokenQ.data ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Защищённая ссылка для подписки в Яндекс.Календаре, Google Calendar или Apple. Включает все задачи ваших досок со сроком.
            </p>
            <div className="rounded-md border border-border bg-surface p-2 text-xs font-mono break-all text-foreground">
              {url}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  toast.success("Ссылка скопирована");
                }}
              >
                <Copy className="h-4 w-4" /> Скопировать
              </Button>
              <Button size="sm" variant="ghost" onClick={onRevoke}>
                <RotateCcw className="h-4 w-4" /> Сбросить
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              В Яндекс.Календаре: «Добавить календарь → По ссылке» — вставьте URL.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ссылка ещё не создана.</p>
            <Button size="sm" onClick={onCreate}>
              <Link2 className="h-4 w-4" /> Создать ссылку
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({
  event,
  calendars,
  onClose,
  onUpdated,
  onDeleted,
}: {
  event: any;
  calendars: any[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const updateEvent = useServerFn(updateCalendarEvent);
  const deleteEvent = useServerFn(deleteCalendarEvent);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: event.title ?? "",
    description: event.description ?? "",
    startTime: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : "",
    endTime: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : "",
    allDay: event.all_day ?? false,
  });
  const [busy, setBusy] = useState(false);

  const cal = calendars.find((c: any) => c.id === event.calendar_id);

  const onSave = async () => {
    setBusy(true);
    try {
      await updateEvent({
        data: {
          eventId: event.id,
          title: form.title,
          description: form.description || undefined,
          startTime: form.allDay
            ? new Date(event.start_time).toISOString().slice(0, 10) + "T09:00"
            : new Date(form.startTime).toISOString(),
          endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
          allDay: form.allDay,
        },
      });
      toast.success("Событие обновлено");
      onUpdated();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  const onDelete = async () => {
    if (!confirm("Удалить событие?")) return;
    setBusy(true);
    try {
      await deleteEvent({ data: { eventId: event.id } });
      toast.success("Событие удалено");
      onDeleted();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Редактировать событие" : "Событие"}</DialogTitle>
        </DialogHeader>
        {editing ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Название</div>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Описание</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
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
              <Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
              <Button onClick={onSave} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Сохранить
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {cal && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={`h-3 w-3 rounded-full ${COLOR_MAP[cal.color ?? "brand"] ?? COLOR_MAP.brand}`} />
                {cal.name}
              </div>
            )}
            <div className="text-lg font-semibold text-foreground">{event.title}</div>
            {event.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            )}
            <div className="text-sm text-muted-foreground">
              {event.all_day ? (
                <span>Весь день — {new Date(event.start_time).toLocaleDateString("ru-RU")}</span>
              ) : (
                <span>
                  {new Date(event.start_time).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                  {event.end_time && (
                    <> — {new Date(event.end_time).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}</>
                  )}
                </span>
              )}
            </div>
            {event.task_id && (
              <div className="rounded-md bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
                Привязано к заданию
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={busy}>
                <Trash2 className="h-4 w-4" /> Удалить
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Редактировать
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
