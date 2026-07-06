import { supabase } from "@/integrations/supabase/client";
import type { TaskRow } from "./boards-api";

type AnyClient = any;

export interface CalendarTokenRow {
  id: string;
  user_id: string;
  token: string;
  calendar_id: string | null;
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
    .is("calendar_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CalendarTokenRow | null) ?? null;
}

export async function getCalendarTokens(userId: string): Promise<CalendarTokenRow[]> {
  const client = supabase as AnyClient;
  const { data, error } = await client
    .from("calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CalendarTokenRow[];
}

export async function getOrCreateCalendarToken(
  userId: string,
  calendarId?: string | null
): Promise<CalendarTokenRow> {
  const client = supabase as AnyClient;
  const calId = calendarId ?? null;
  let query = client
    .from("calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);
  if (calId) {
    query = query.eq("calendar_id", calId);
  } else {
    query = query.is("calendar_id", null);
  }
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing as CalendarTokenRow;

  const token = randomHex(16);
  const { data, error } = await client
    .from("calendar_tokens")
    .insert({ user_id: userId, token, calendar_id: calId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CalendarTokenRow;
}

export async function revokeCalendarToken(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
