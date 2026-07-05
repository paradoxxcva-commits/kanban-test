import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Archive, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  createColumn,
  deleteBoard,
  getBoard,
  listColumns,
  listTasks,
  persistOrder,
  type TaskRow,
} from "@/lib/boards-api";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { KanbanColumn } from "@/components/boards/kanban-column";
import { TaskCard } from "@/components/boards/task-card";
import { TaskDialog } from "@/components/boards/task-dialog";
import { BoardFilters } from "@/components/boards/board-filters";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/boards/$boardId")({
  component: BoardPage,
});

interface Member {
  id: string;
  full_name: string | null;
  email: string;
}

function BoardPage() {
  const { boardId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, user, hasRole } = useAuth();
  const { selectedOrgId } = useOrg();

  const canManageBoard = hasRole("admin") || hasRole("super_admin");

  const { data, isLoading } = useQuery({
    queryKey: ["board", boardId, showArchived],
    queryFn: async () => {
      const [board, columns, tasks] = await Promise.all([
        getBoard(boardId),
        listColumns(boardId),
        listTasks(boardId, { includeArchived: showArchived }),
      ]);
      return { board, columns, tasks };
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", selectedOrgId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("org_id", selectedOrgId!);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    enabled: !!selectedOrgId,
  });

  // Local optimistic ordering
  const [localTasks, setLocalTasks] = useState<TaskRow[] | null>(null);
  const tasks = localTasks ?? data?.tasks ?? [];

  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogColumnId, setTaskDialogColumnId] = useState<string | undefined>();
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState("");

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !(t.description?.toLowerCase().includes(q))
        )
          return false;
      }
      if (filterPriority.length > 0 && !filterPriority.includes(t.priority ?? "normal"))
        return false;
      if (filterAssignee.length > 0 && t.assignee_id && !filterAssignee.includes(t.assignee_id))
        return false;
      if (filterStatus === "open" && t.completed_at) return false;
      if (filterStatus === "completed" && !t.completed_at) return false;
      return true;
    });
  }, [tasks, filterSearch, filterPriority, filterAssignee, filterStatus]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    (data?.columns ?? []).forEach((c) => map.set(c.id, []));
    for (const t of filteredTasks) {
      if (t.column_id && map.has(t.column_id)) map.get(t.column_id)!.push(t);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [filteredTasks, data?.columns]);

  // Fetch comment counts and full comments for unread tracking
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { data: commentsData = [] } = useQuery({
    queryKey: ["commentCounts", boardId],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("task_comments")
        .select("task_id, author_id, created_at")
        .in("task_id", taskIds);
      return data ?? [];
    },
    enabled: taskIds.length > 0,
  });

  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    commentsData.forEach((c: any) => {
      counts[c.task_id] = (counts[c.task_id] || 0) + 1;
    });
    return counts;
  }, [commentsData]);

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const lastReadCache: Record<string, string | null> = {};
    taskIds.forEach((id) => {
      const lastRead = lastReadCache[id] ?? (() => {
        const v = localStorage.getItem(`comment_read_${id}`);
        lastReadCache[id] = v;
        return v;
      })();
      const ts = lastRead ? new Date(lastRead).getTime() : 0;
      counts[id] = commentsData.filter((c: any) =>
        c.task_id === id && c.author_id !== user?.id && new Date(c.created_at).getTime() > ts
      ).length;
    });
    return counts;
  }, [commentsData, taskIds, user?.id]);

  const persistMut = useMutation({
    mutationFn: persistOrder,
    onError: (e: Error) => {
      toast.error(e.message);
      setLocalTasks(null);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
    onSuccess: () => {
      setLocalTasks(null);
      qc.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });

  const addColumnMut = useMutation({
    mutationFn: () => createColumn(boardId, newColName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      setAddColumnOpen(false);
      setNewColName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBoardMut = useMutation({
    mutationFn: () => deleteBoard(boardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boards"] });
      navigate({ to: "/boards" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function findTask(id: string): TaskRow | undefined {
    return tasks.find((t) => t.id === id);
  }

  function onDragStart(e: DragStartEvent) {
    const t = findTask(String(e.active.id));
    if (t) setActiveTask(t);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const current = localTasks ?? data?.tasks ?? [];
    const activeIdx = current.findIndex((t) => t.id === activeId);
    if (activeIdx < 0) return;
    const activeT = current[activeIdx];

    // Determine target column
    let targetColumn: string | null = null;
    const overIsColumn = (data?.columns ?? []).some((c) => c.id === overId);
    if (overIsColumn) {
      targetColumn = overId;
    } else {
      const overT = current.find((t) => t.id === overId);
      targetColumn = overT?.column_id ?? null;
    }
    if (!targetColumn || targetColumn === activeT.column_id) return;

    // Move across columns
    const next = current.slice();
    next[activeIdx] = { ...activeT, column_id: targetColumn };
    setLocalTasks(next);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const current = localTasks ?? data?.tasks ?? [];
    const activeT = current.find((t) => t.id === activeId);
    if (!activeT || !activeT.column_id) return;

    let targetColumn = activeT.column_id;
    const overIsColumn = (data?.columns ?? []).some((c) => c.id === overId);
    if (overIsColumn) targetColumn = overId;
    else {
      const overT = current.find((t) => t.id === overId);
      if (overT?.column_id) targetColumn = overT.column_id;
    }

    // Build ordered list for source and target columns
    const sourceColumn = (data?.tasks ?? []).find((t) => t.id === activeId)?.column_id ?? activeT.column_id;

    // Get current items in target column from local state
    const inTarget = current.filter((t) => t.column_id === targetColumn).sort((a, b) => a.position - b.position);
    const activeIdxInTarget = inTarget.findIndex((t) => t.id === activeId);
    let overIdxInTarget = inTarget.findIndex((t) => t.id === overId);
    if (overIdxInTarget < 0) overIdxInTarget = inTarget.length - 1;

    const reordered =
      activeIdxInTarget >= 0
        ? arrayMove(inTarget, activeIdxInTarget, overIdxInTarget)
        : inTarget;

    const affected: { columnId: string; taskIds: string[] }[] = [
      { columnId: targetColumn, taskIds: reordered.map((t) => t.id) },
    ];
    if (sourceColumn && sourceColumn !== targetColumn) {
      const inSource = current
        .filter((t) => t.column_id === sourceColumn && t.id !== activeId)
        .sort((a, b) => a.position - b.position);
      affected.push({ columnId: sourceColumn, taskIds: inSource.map((t) => t.id) });
    }

    // Optimistic apply with new positions
    const newLocal = current.map((t) => {
      for (const a of affected) {
        const idx = a.taskIds.indexOf(t.id);
        if (idx >= 0) return { ...t, column_id: a.columnId, position: idx };
      }
      return t;
    });
    setLocalTasks(newLocal);
    persistMut.mutate(affected);
  }

  function openCreateTask(columnId: string) {
    setEditingTask(null);
    setTaskDialogColumnId(columnId);
    setTaskDialogOpen(true);
  }

  function openEditTask(task: TaskRow) {
    setEditingTask(task);
    setTaskDialogColumnId(task.column_id ?? undefined);
    setTaskDialogOpen(true);
  }

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">Загрузка доски…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/boards"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Доска
              </div>
              <h1 className="text-lg font-semibold text-foreground">{data.board.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManageBoard && (
              <Button variant="secondary" onClick={() => setAddColumnOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Колонка
              </Button>
            )}
            {canManageBoard && (
              <Button
                variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(!showArchived)}
                className="gap-1.5"
              >
                <Archive className="h-4 w-4" />
                Архив
              </Button>
            )}
            {canManageBoard && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Удалить доску «${data.board.name}»? Это необратимо.`))
                    deleteBoardMut.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="px-6 pb-2">
          <BoardFilters
            search={filterSearch}
            onSearchChange={setFilterSearch}
            priority={filterPriority}
            onPriorityChange={setFilterPriority}
            assignee={filterAssignee}
            onAssigneeChange={setFilterAssignee}
            status={filterStatus}
            onStatusChange={setFilterStatus}
            members={members ?? []}
            totalCount={tasks.length}
            filteredCount={filteredTasks.length}
          />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-6">
            {data.columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn.get(col.id) ?? []}
                boardId={boardId}
                members={members ?? []}
                onAddTask={openCreateTask}
                onEditTask={openEditTask}
                canManage={canManageBoard}
                commentCounts={commentCounts}
                unreadCounts={unreadCounts}
              />
            ))}
            {canManageBoard && (
              <button
                type="button"
                onClick={() => setAddColumnOpen(true)}
                className="flex h-12 w-[300px] shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Новая колонка
              </button>
            )}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        boardId={boardId}
        columns={data.columns}
        initialColumnId={taskDialogColumnId}
        task={editingTask}
        isArchived={!!editingTask?.archived_at}
      />

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая колонка</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newColName.trim()) addColumnMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="col-name">Название</Label>
              <Input
                id="col-name"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Например, На проверке"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddColumnOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={addColumnMut.isPending || !newColName.trim()}>
                {addColumnMut.isPending ? "Создаём…" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
