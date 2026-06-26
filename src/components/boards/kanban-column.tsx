import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TaskCard } from "./task-card";
import { deleteColumn, renameColumn, type ColumnRow, type TaskRow } from "@/lib/boards-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  full_name: string | null;
  email: string;
}

export function KanbanColumn({
  column,
  tasks,
  boardId,
  members,
  onAddTask,
  onEditTask,
  canManage = false,
  commentCounts = {},
  unreadCounts = {},
}: {
  column: ColumnRow;
  tasks: TaskRow[];
  boardId: string;
  members: Member[];
  onAddTask: (columnId: string) => void;
  onEditTask: (task: TaskRow) => void;
  canManage?: boolean;
  commentCounts?: Record<string, number>;
  unreadCounts?: Record<string, number>;
}) {
  const qc = useQueryClient();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const renameMut = useMutation({
    mutationFn: () => renameColumn(column.id, name.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteColumn(column.id, boardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name.trim() !== column.name) renameMut.mutate();
              else setName(column.name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setName(column.name);
                setEditing(false);
              }
            }}
            autoFocus
            className="h-7 text-sm"
          />
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{column.name}</h3>
            <span className="text-mono rounded bg-accent px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {tasks.length}
            </span>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title="Добавить задачу"
          >
            <Plus className="h-4 w-4" />
          </button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Действия с колонкой"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Переименовать
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (confirm(`Удалить колонку «${column.name}»? Задачи будут перемещены.`))
                      deleteMut.mutate();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg border border-transparent bg-sidebar/40 p-2 transition",
          isOver && "border-brand/40 bg-brand/5",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => {
            const m = t.assignee_id ? memberMap.get(t.assignee_id) : null;
            return (
              <TaskCard
                key={t.id}
                task={t}
                assigneeName={m?.full_name}
                assigneeEmail={m?.email}
                commentCount={commentCounts[t.id]}
                unreadCount={unreadCounts[t.id]}
                onClick={() => onEditTask(t)}
              />
            );
          })}
        </SortableContext>
        <button
          type="button"
          onClick={() => onAddTask(column.id)}
          className="mt-1 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
        >
          + Добавить задачу
        </button>
      </div>
    </div>
  );
}
