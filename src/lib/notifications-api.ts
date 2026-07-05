import { supabase } from "@/integrations/supabase/client";

type AnyClient = any;

export interface Notification {
  id: string;
  user_id: string;
  org_id: string;
  type: "message" | "task_assigned" | "task_due_soon" | "comment" | "reminder";
  title: string;
  body: string | null;
  link: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPrefs {
  user_id: string;
  message_enabled: boolean;
  task_enabled: boolean;
  comment_enabled: boolean;
  reminder_enabled: boolean;
  browser_push: boolean;
  updated_at: string;
}

export async function getUnreadNotifications(limit = 50): Promise<Notification[]> {
  const client = supabase as AnyClient;
  const { data, error } = await client.rpc("get_unread_notifications", { _limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const client = supabase as AnyClient;
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const client = supabase as AnyClient;
  const { error } = await client.rpc("mark_notification_read", { _notif_id: notifId });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const client = supabase as AnyClient;
  const { error } = await client.rpc("mark_all_notifications_read");
  if (error) throw new Error(error.message);
}

export async function markMessageNotificationsRead(): Promise<void> {
  const client = supabase as AnyClient;
  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("type", "message")
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const client = supabase as AnyClient;
  const { data, error } = await client.rpc("get_or_create_notification_prefs");
  if (error) throw new Error(error.message);
  return data as unknown as NotificationPrefs;
}

export async function updateNotificationPrefs(prefs: {
  message_enabled?: boolean;
  task_enabled?: boolean;
  comment_enabled?: boolean;
  reminder_enabled?: boolean;
  browser_push?: boolean;
}): Promise<void> {
  const client = supabase as AnyClient;
  const { error } = await client.rpc("update_notification_prefs", {
    _message_enabled: prefs.message_enabled ?? null,
    _task_enabled: prefs.task_enabled ?? null,
    _comment_enabled: prefs.comment_enabled ?? null,
    _reminder_enabled: prefs.reminder_enabled ?? null,
    _browser_push: prefs.browser_push ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createNotification(params: {
  userId: string;
  orgId: string;
  type: Notification["type"];
  title: string;
  body?: string;
  link?: string;
  entityId?: string;
}): Promise<string | null> {
  const client = supabase as AnyClient;
  const { data, error } = await client.rpc("create_notification", {
    _user_id: params.userId,
    _org_id: params.orgId,
    _type: params.type,
    _title: params.title,
    _body: params.body ?? null,
    _link: params.link ?? null,
    _entity_id: params.entityId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string | null;
}
