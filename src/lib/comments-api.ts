import { supabase } from "@/integrations/supabase/client";

export interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  created_at: string;
}

export async function listComments(taskId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export async function createComment(input: {
  task_id: string;
  body: string | null;
  author_id: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  attachment_mime?: string;
}): Promise<CommentRow> {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: input.task_id,
      body: input.body,
      author_id: input.author_id,
      attachment_url: input.attachment_url ?? null,
      attachment_name: input.attachment_name ?? null,
      attachment_size: input.attachment_size ?? null,
      attachment_mime: input.attachment_mime ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function getAttachmentUrl(path: string): string {
  const { data } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(path);
  return data?.publicUrl ?? "";
}
