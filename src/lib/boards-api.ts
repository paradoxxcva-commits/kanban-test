import { supabase } from "@/integrations/supabase/client";

export interface BoardRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ColumnRow {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  board_id: string;
  column_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  priority: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listBoards(): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export async function getBoard(id: string): Promise<BoardRow> {
  const { data, error } = await supabase.from("boards").select("*").eq("id", id).single();
  if (error) throw error;
  return data as BoardRow;
}

export async function createBoard(input: {
  name: string;
  description?: string;
  color?: string;
  org_id: string;
  created_by: string;
}): Promise<BoardRow> {
  const { data, error } = await supabase
    .from("boards")
    .insert({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "brand",
      org_id: input.org_id,
      created_by: input.created_by,
    })
    .select()
    .single();
  if (error) throw error;
  // Seed default columns
  const board = data as BoardRow;
  const defaults = [
    { name: "К выполнению", position: 0 },
    { name: "В работе", position: 1 },
    { name: "Готово", position: 2 },
  ];
  await supabase
    .from("board_columns")
    .insert(defaults.map((c) => ({ ...c, board_id: board.id })));
  return board;
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) throw error;
}

export async function listColumns(boardId: string): Promise<ColumnRow[]> {
  const { data, error } = await supabase
    .from("board_columns")
    .select("*")
    .eq("board_id", boardId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as ColumnRow[];
}

export async function createColumn(boardId: string, name: string): Promise<ColumnRow> {
  const { data: existing } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;
  const { data, error } = await supabase
    .from("board_columns")
    .insert({ board_id: boardId, name, position: nextPos })
    .select()
    .single();
  if (error) throw error;
  return data as ColumnRow;
}

export async function renameColumn(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("board_columns").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteColumn(id: string, boardId: string): Promise<void> {
  // Move tasks to first remaining column
  const { data: cols } = await supabase
    .from("board_columns")
    .select("id, position")
    .eq("board_id", boardId)
    .neq("id", id)
    .order("position");
  const fallback = cols?.[0]?.id;
  if (fallback) {
    await supabase.from("tasks").update({ column_id: fallback }).eq("column_id", id);
  } else {
    await supabase.from("tasks").delete().eq("column_id", id);
  }
  const { error } = await supabase.from("board_columns").delete().eq("id", id);
  if (error) throw error;
}

export async function listTasks(boardId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("board_id", boardId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function createTask(input: {
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  created_by: string;
}): Promise<TaskRow> {
  const { data: tail } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", input.column_id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = ((tail?.[0]?.position as number | undefined) ?? -1) + 1;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      board_id: input.board_id,
      column_id: input.column_id,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      assignee_id: input.assignee_id ?? null,
      due_date: input.due_date ?? null,
      created_by: input.created_by,
      position: nextPos,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    priority: string;
    assignee_id: string | null;
    due_date: string | null;
    completed_at: string | null;
  }>,
): Promise<void> {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/** Reorder & move: pass full ordered task ids per column for the affected columns. */
export async function persistOrder(
  affected: { columnId: string; taskIds: string[] }[],
): Promise<void> {
  const updates: Promise<unknown>[] = [];
  for (const { columnId, taskIds } of affected) {
    taskIds.forEach((id, idx) => {
      updates.push(
        supabase.from("tasks").update({ column_id: columnId, position: idx }).eq("id", id),
      );
    });
  }
  await Promise.all(updates);
}
