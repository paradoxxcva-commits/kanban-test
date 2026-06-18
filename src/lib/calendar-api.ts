import { supabase } from "@/integrations/supabase/client";
import type { TaskRow } from "./boards-api";

export interface CalendarTokenRow {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
}

export async function listTasksInRange(from: Date, to: Date): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .not("due_date", "is", null)
    .gte("due_date", from.toISOString())
    .lt("due_date", to.toISOString())
    .order("due_date");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getActiveCalendarToken(userId: string): Promise<CalendarTokenRow | null> {
  const { data, error } = await supabase
    .from("calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CalendarTokenRow | null) ?? null;
}

export async function getOrCreateCalendarToken(userId: string): Promise<CalendarTokenRow> {
  const existing = await getActiveCalendarToken(userId);
  if (existing) return existing;
  const token = randomHex(16);
  const { data, error } = await supabase
    .from("calendar_tokens")
    .insert({ user_id: userId, token })
    .select()
    .single();
  if (error) throw error;
  return data as CalendarTokenRow;
}

export async function revokeCalendarToken(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
