import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createTask,
  deleteTask,
  updateTask,
  type ColumnRow,
  type TaskRow,
} from "@/lib/boards-api";
import { useAuth } from "@/lib/auth-context";
import { createNotification } from "@/lib/notifications-api";
import { toast } from "sonner";
import { Trash2, Calendar, Loader2, Bell } from "lucide-react";
import { listCalendars, sendTaskToCalendar } from "@/lib/calendar.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskComments, getUnreadCommentCount } from "./task-comments";
import { TaskReminderDialog } from "./task-reminder-dialog";
import type { CommentRow } from "@/lib/comments-api";

interface Member {
  id: string;
  full_name: string | null;
  email: string;
}

async function listMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("org_id", orgId);
  if (error) throw error;
  return (data ?? []) as Member[];
}

const PRIORITIES = [
  { id: "low", label: "Низкий" },
  { id: "normal", label: "Обычный" },
  { id: "high", label: "Высокий" },
  { id: "urgent", label: "Срочно" },
];

export function TaskDialog({
  open,
  onOpenChange,
  boardId,
  columns,
  initialColumnId,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: string;
  columns: ColumnRow[];
  initialColumnId?: string;
  task?: TaskRow | null;
}) {
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const isEdit = !!task;

  // Unread comment count for the tab badge
  const { data: dialogComments = [] } = useQuery({
    queryKey: ["comments", task?.id],
    queryFn: async () => {
      if (!task) return [];
      const { data } = await (supabase as any)
        .from("task_comments")
        .select("author_id, created_at")
        .eq("task_id", task.id);
      return (data ?? []) as Pick<CommentRow, "author_id" | "created_at">[];
    },
    enabled: !!task && isEdit,
  });
  const unreadCommentCount = task && user
    ? getUnreadCommentCount(task.id, dialogComments as CommentRow[], user.id)
    : 0;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [columnId, setColumnId] = useState(task?.column_id ?? initialColumnId ?? columns[0]?.id ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "normal");
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee_id ?? "none");
  const [dueDate, setDueDate] = useState<string>(
    task?.due_date ? task.due_date.slice(0, 10) : "",
  );
  const [completed, setCompleted] = useState(!!task?.completed_at);

  useMemo(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setColumnId(task?.column_id ?? initialColumnId ?? columns[0]?.id ?? "");
    setPriority(task?.priority ?? "normal");
    setAssigneeId(task?.assignee_id ?? "none");
    setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
    setCompleted(!!task?.completed_at);
  }, [task, initialColumnId, columns]);

  const { data: members } = useQuery({
    queryKey: ["members", profile?.org_id],
    queryFn: () => listMembers(profile!.org_id!),
    enabled: !!profile?.org_id && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Нет сессии");
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee_id: assigneeId === "none" ? null : assigneeId,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };
      if (isEdit && task) {
        await updateTask(task.id, {
          ...payload,
          completed_at: completed
            ? task.completed_at ?? new Date().toISOString()
            : null,
        });
        if (columnId !== task.column_id) {
          await supabase.from("tasks").update({ column_id: columnId }).eq("id", task.id);
        }
        if (assigneeId !== "none" && assigneeId !== task.assignee_id && profile?.org_id) {
          createNotification({
            userId: assigneeId,
            orgId: profile.org_id,
            type: "task_assigned",
            title: title.trim(),
            body: `Задача назначена вам`,
            link: `/boards/${boardId}`,
            entityId: task.id,
          }).catch(() => {});
        }
      } else {
        await createTask({
          board_id: boardId,
          column_id: columnId,
          title: payload.title,
          description: payload.description ?? undefined,
          priority,
          assignee_id: payload.assignee_id,
          due_date: payload.due_date,
          created_by: user.id,
        });
        if (assigneeId !== "none" && profile?.org_id) {
          createNotification({
            userId: assigneeId,
            orgId: profile.org_id,
            type: "task_assigned",
            title: title.trim(),
            body: `Новая задача назначена вам`,
            link: `/boards/${boardId}`,
          }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!task) return;
      await deleteTask(task.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send to calendar
  const [sendCalendarOpen, setSendCalendarOpen] = useState(false);
  const [sendCalendarId, setSendCalendarId] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  // Reminder
  const [reminderOpen, setReminderOpen] = useState(false);

  const { data: calendars } = useQuery({
    queryKey: ["calendars", profile?.org_id],
    queryFn: () => listCalendars({ data: { orgId: profile!.org_id! } }),
    enabled: !!profile?.org_id && sendCalendarOpen,
  });

  const onSendToCalendar = async () => {
    if (!task || !sendCalendarId) return;
    setSendBusy(true);
    try {
      await sendTaskToCalendar({ data: { taskId: task.id, calendarId: sendCalendarId } });
      toast.success("Задание отправлено в календарь");
      setSendCalendarOpen(false);
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setSendBusy(false);
  };

  const taskForm = (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="t-title">Название</Label>
        <Input
          id="t-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-desc">Описание</Label>
        <Textarea
          id="t-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Колонка</Label>
          <Select value={columnId} onValueChange={setColumnId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Приоритет</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Исполнитель</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder="Не назначен" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не назначен</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-due">Срок</Label>
          <Input
            id="t-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Задача выполнена
        </label>
      )}
      <DialogFooter className="gap-2 sm:gap-2">
        {isEdit && task && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              onClick={() => setSendCalendarOpen(true)}
            >
              <Calendar className="h-4 w-4" />
              В календарь
            </Button>
            {task.due_date && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReminderOpen(true)}
              >
                <Bell className="h-4 w-4" />
                Напоминание
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Удалить задачу?")) remove.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
        <Button type="submit" disabled={save.isPending || !title.trim()}>
          {save.isPending ? "Сохраняем…" : isEdit ? "Сохранить" : "Создать"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isEdit ? "max-w-2xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать задачу" : "Новая задача"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Измените поля задачи и сохраните." : "Заполните поля и создайте задачу."}
          </DialogDescription>
        </DialogHeader>

        {isEdit && task ? (
          <Tabs defaultValue="task">
            <TabsList className="w-full">
              <TabsTrigger value="task" className="flex-1">Задача</TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                Комментарии
                {unreadCommentCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                    {unreadCommentCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="task">{taskForm}</TabsContent>
            <TabsContent value="comments" className="pt-2">
              <TaskComments taskId={task.id} />
            </TabsContent>
          </Tabs>
        ) : (
          taskForm
        )}
      </DialogContent>

      {/* Send to Calendar Modal */}
      <Dialog open={sendCalendarOpen} onOpenChange={setSendCalendarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить в календарь</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Календарь</div>
              <select
                value={sendCalendarId}
                onChange={(e) => setSendCalendarId(e.target.value)}
                className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Выберите календарь</option>
                {calendars?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSendCalendarOpen(false)}>Отмена</Button>
              <Button onClick={onSendToCalendar} disabled={sendBusy || !sendCalendarId}>
                {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Отправить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      {task && (
        <TaskReminderDialog
          taskId={task.id}
          open={reminderOpen}
          onOpenChange={setReminderOpen}
        />
      )}
    </Dialog>
  );
}
