import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/lib/boards-api";

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-sky-400",
  high: "text-amber-400",
  urgent: "text-rose-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочно",
};

function initials(name: string | null, email: string | null) {
  const src = name || email || "?";
  return src.slice(0, 2).toUpperCase();
}

export function TaskCard({
  task,
  assigneeName,
  assigneeEmail,
  onClick,
  overlay,
}: {
  task: TaskRow;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  onClick?: () => void;
  overlay?: boolean;
}) {
  const sortable = useSortable({
    id: task.id,
    data: { type: "task", columnId: task.column_id },
    disabled: overlay,
  });
  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      };

  const isDue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();
  const done = !!task.completed_at;

  return (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={onClick}
      className={cn(
        "surface-card group cursor-grab space-y-2 p-3 text-left transition active:cursor-grabbing",
        sortable.isDragging && !overlay && "opacity-40",
        overlay && "shadow-card ring-1 ring-brand/40",
        done && "opacity-60",
      )}
    >
      <div className={cn("text-sm font-medium text-foreground", done && "line-through")}>
        {task.title}
      </div>
      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1", PRIORITY_STYLES[task.priority ?? "normal"])}>
            <Flag className="h-3 w-3" />
            {PRIORITY_LABELS[task.priority ?? "normal"]}
          </span>
          {task.due_date && (
            <span className={cn("inline-flex items-center gap-1", isDue && "text-rose-400")}>
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
        </div>
        {task.assignee_id && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-foreground"
            title={assigneeName || assigneeEmail || ""}
          >
            {initials(assigneeName ?? null, assigneeEmail ?? null)}
          </div>
        )}
      </div>
    </div>
  );
}
