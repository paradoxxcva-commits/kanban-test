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
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактировать задачу" : "Новая задача"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Измените поля задачи и сохраните." : "Заполните поля и создайте задачу."}
          </DialogDescription>
        </DialogHeader>
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
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Удалить задачу?")) remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending || !title.trim()}>
              {save.isPending ? "Сохраняем…" : isEdit ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
