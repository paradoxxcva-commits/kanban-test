import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getTaskReminders,
  createTaskReminder,
  deleteTaskReminder,
  type TaskReminder,
} from "@/lib/reminders-api";

const OFFSET_OPTIONS = [
  { label: "1 час", value: 1 },
  { label: "3 часа", value: 3 },
  { label: "6 часов", value: 6 },
  { label: "12 часов", value: 12 },
  { label: "1 день", value: 24 },
  { label: "3 дня", value: 72 },
  { label: "1 неделя", value: 168 },
];

const RECURRENCE_OPTIONS = [
  { label: "Без повтора", value: "none" },
  { label: "Еженедельно", value: "weekly" },
  { label: "Ежемесячно", value: "monthly" },
];

export function TaskReminderDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();

  const { data: reminders = [] } = useQuery({
    queryKey: ["task-reminders", taskId],
    queryFn: () => getTaskReminders(taskId),
    enabled: open,
  });

  const [offsetHours, setOffsetHours] = useState(24);
  const [recurrence, setRecurrence] = useState("none");

  const createMut = useMutation({
    mutationFn: () =>
      createTaskReminder({
        taskId,
        offsetHours,
        isRecurring: recurrence !== "none",
        recurrence: recurrence === "none" ? null : recurrence,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-reminders", taskId] });
      toast.success("Напоминание создано");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTaskReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-reminders", taskId] });
      toast.success("Напоминание удалено");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Напоминание
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {reminders.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Активные напоминания
              </div>
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      За {OFFSET_OPTIONS.find((o) => o.value === r.offset_hours)?.label ?? `${r.offset_hours}ч`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.is_recurring
                        ? `Повтор: ${RECURRENCE_OPTIONS.find((o) => o.value === r.recurrence)?.label ?? r.recurrence}`
                        : "Одноразовое"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMut.mutate(r.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Напомнить за
              </div>
              <Select
                value={String(offsetHours)}
                onValueChange={(v) => setOffsetHours(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFSET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Повтор
              </div>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              Создать напоминание
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
