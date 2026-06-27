import { supabase } from "@/integrations/supabase/client";

type AnyClient = any;

export interface TaskReminder {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  offset_hours: number;
  is_recurring: boolean;
  recurrence: string | null;
  last_sent_at: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getTaskReminders(taskId: string): Promise<TaskReminder[]> {
  const client = supabase as AnyClient;
  const { data, error } = await client.rpc("get_task_reminders", { _task_id: taskId });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskReminder[];
}

export async function createTaskReminder(params: {
  taskId: string;
  offsetHours?: number;
  isRecurring?: boolean;
  recurrence?: string | null;
}): Promise<string> {
  const client = supabase as AnyClient;
  const { data, error } = await client.rpc("create_task_reminder", {
    _task_id: params.taskId,
    _offset_hours: params.offsetHours ?? 24,
    _is_recurring: params.isRecurring ?? false,
    _recurrence: params.recurrence ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteTaskReminder(reminderId: string): Promise<void> {
  const client = supabase as AnyClient;
  const { error } = await client.rpc("delete_task_reminder", { _reminder_id: reminderId });
  if (error) throw new Error(error.message);
}
