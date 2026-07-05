import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Calendar, Flag, MessageSquare } from "lucide-react";
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
  commentCount,
  unreadCount,
  onClick,
  overlay,
  isArchived,
}: {
  task: TaskRow;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  commentCount?: number;
  unreadCount?: number;
  onClick?: () => void;
  overlay?: boolean;
  isArchived?: boolean;
}) {
  const sortable = useSortable({
    id: task.id,
    data: { type: "task", columnId: task.column_id },
    disabled: overlay || isArchived,
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
        isArchived && "opacity-50 grayscale",
      )}
    >
      <div className={cn("text-sm font-medium text-foreground", done && "line-through")}>
        {task.title}
        {isArchived && (
          <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Archive className="h-3 w-3" />
            В архиве
          </span>
        )}
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
          {commentCount != null && commentCount > 0 && (
            <span className={`inline-flex items-center gap-1 ${unreadCount != null && unreadCount > 0 ? "font-semibold text-brand" : ""}`}>
              <MessageSquare className="h-3 w-3" />
              {commentCount}
              {unreadCount != null && unreadCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                  {unreadCount}
                </span>
              )}
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
