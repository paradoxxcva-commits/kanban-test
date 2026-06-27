import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Send, MessageSquare, FileText, Loader2, Headphones, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications-api";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Чат — Планка" }] }),
  component: ChatPage,
});

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
  org_name?: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  created_at: string;
  inserted_at: string;
  updated_at: string;
  read_at: string | null;
}

function initials(name: string | null, email: string) {
  const src = (name && name.trim()) || email;
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-foreground tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ChatPage() {
  const { user, profile, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  const [selected, setSelected] = useState<string | null>(null);

  if (isSuperAdmin) {
    return (
      <SuperAdminChat
        user={user!}
        profile={profile}
        selected={selected}
        setSelected={setSelected}
      />
    );
  }
  return (
    <UserChat
      user={user!}
      profile={profile}
      selected={selected}
      setSelected={setSelected}
    />
  );
}

function SuperAdminChat({
  user,
  profile,
  selected,
  setSelected,
}: {
  user: { id: string };
  profile: any;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const { data: supportChats } = useQuery({
    queryKey: ["support-chats", user.id],
    queryFn: async () => {
      const { data: received } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, inserted_at")
        .eq("recipient_id", user.id)
        .order("inserted_at", { ascending: false });

      const peerIds = new Set<string>();
      (received ?? []).forEach((m) => {
        if (m.sender_id !== user.id) peerIds.add(m.sender_id);
      });

      if (peerIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, org_id")
        .in("id", Array.from(peerIds));

      const orgIds = [
        ...new Set((profiles ?? []).map((p) => p.org_id).filter(Boolean)),
      ];
      let orgNames: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);
        (orgs ?? []).forEach((o: any) => (orgNames[o.id] = o.name));
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        org_name: p.org_id ? orgNames[p.org_id] ?? null : null,
      }));
    },
  });

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!supportChats || !user) return;
    let cancelled = false;
    (async () => {
      const results: Record<string, number> = {};
      for (const chat of supportChats) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", chat.id)
          .eq("recipient_id", user.id)
          .is("read_at", null);
        results[chat.id] = count ?? 0;
      }
      if (!cancelled) setUnreadMap(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [supportChats, user]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Headphones className="h-3.5 w-3.5" /> Техподдержка
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              Обращения пользователей
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {(supportChats ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition ${
                  selected === u.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(u.full_name, u.email)}
                  {(unreadMap[u.id] ?? 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                      {unreadMap[u.id]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {u.full_name || u.email}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {u.org_name ? `${u.org_name} · ` : ""}
                    {u.email}
                  </div>
                </div>
              </button>
            ))}
            {supportChats?.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                Обращений пока нет.
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <ChatThread
              me={user.id}
              peerId={selected}
              peer={supportChats?.find((u) => u.id === selected)}
              orgId={supportChats?.find((u) => u.id === selected)?.org_id}
              onOpen={() => {
                setUnreadMap((prev) => ({ ...prev, [selected]: 0 }));
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Выберите обращение для ответа
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function UserChat({
  user,
  profile,
  selected,
  setSelected,
}: {
  user: { id: string };
  profile: any;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const { data: superAdmin } = useQuery({
    queryKey: ["super-admin-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin")
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", data.user_id)
        .maybeSingle();
      return profile as OrgUser | null;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["org-users", profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("org_id", profile!.org_id!)
        .neq("id", user!.id)
        .order("full_name");
      if (error) throw error;
      return (data as OrgUser[]) ?? [];
    },
  });

  const isSupportSelected = selected && superAdmin && selected === superAdmin.id;

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const allContacts = useMemo(() => {
    const list: OrgUser[] = [];
    if (superAdmin) list.push(superAdmin);
    list.push(...(users ?? []));
    return list;
  }, [superAdmin, users]);

  useEffect(() => {
    if (!allContacts.length || !user) return;
    let cancelled = false;
    (async () => {
      const results: Record<string, number> = {};
      for (const c of allContacts) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", c.id)
          .eq("recipient_id", user.id)
          .is("read_at", null);
        results[c.id] = count ?? 0;
      }
      if (!cancelled) setUnreadMap(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [allContacts, user]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Чат
            </div>
          </div>

          {superAdmin && (
            <div className="border-b border-border p-2">
              <button
                onClick={() => setSelected(superAdmin.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition ${
                  isSupportSelected
                    ? "bg-brand/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-semibold text-brand">
                  <Headphones className="h-4 w-4" />
                  {(unreadMap[superAdmin.id] ?? 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                      {unreadMap[superAdmin.id]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    Техподдержка
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    Написать администратору
                  </div>
                </div>
              </button>
            </div>
          )}

          <div className="p-2">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Сотрудники организации
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!profile?.org_id && (
              <div className="p-4 text-xs text-muted-foreground">
                Вы не привязаны к организации.
              </div>
            )}
            {(users ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition ${
                  selected === u.id && !isSupportSelected
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(u.full_name, u.email)}
                  {(unreadMap[u.id] ?? 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
                      {unreadMap[u.id]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {u.full_name || u.email}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {u.email}
                  </div>
                </div>
              </button>
            ))}
            {users?.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                В организации пока только вы.
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <ChatThread
              me={user.id}
              peerId={selected}
              peer={
                isSupportSelected
                  ? superAdmin
                  : users?.find((u) => u.id === selected)
              }
              orgId={profile?.org_id}
              onOpen={() => {
                setUnreadMap((prev) => ({ ...prev, [selected]: 0 }));
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Выберите собеседника, чтобы начать диалог
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ChatThread({
  me,
  peerId,
  peer,
  orgId,
  onOpen,
}: {
  me: string;
  peerId: string;
  peer?: OrgUser | null;
  orgId?: string | null;
  onOpen?: () => void;
}) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["messages", me, peerId], [me, peerId]);
  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, body, attachment_url, attachment_name, attachment_size, attachment_mime, created_at, inserted_at, updated_at, read_at")
        .or(
          `and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`
        )
        .order("inserted_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data as unknown as Message[]) ?? [];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (messages.length > 0) onOpen?.();
  }, []);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (messages.length === 0) return;
    const unreadMessages = messages.filter(
      (m) => m.sender_id === peerId && m.recipient_id === me && !m.read_at
    );
    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .then(() => {
        qc.setQueryData<Message[]>(queryKey, (prev) =>
          prev?.map((m) =>
            ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
          )
        );
      });
  }, [messages, me, peerId, qc, queryKey]);

  useEffect(() => {
    const ch = supabase
      .channel(`dm-${[me, peerId].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (
            (m.sender_id === me && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === me)
          ) {
            qc.setQueryData<Message[]>(queryKey, (prev) =>
              prev ? [...prev, m] : [m]
            );
          }
          // Browser notification for incoming messages from others
          if (m.sender_id !== me && m.recipient_id === me) {
            const prefs = localStorage.getItem("notifications");
            if (prefs !== "false" && "Notification" in window && document.hidden) {
              new Notification("Новое сообщение", {
                body: m.body || m.content || "Файл",
                icon: "/favicon.ico",
              });
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, peerId, qc, queryKey]);

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async (attachment?: {
    url: string;
    name: string;
    size: number;
    mime: string;
  }) => {
    if (!body.trim() && !attachment) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: me,
      recipient_id: peerId,
      content: body.trim() || "",
      body: body.trim() || null,
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
      attachment_mime: attachment?.mime ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error("Не удалось отправить", { description: error.message });
      return;
    }
    setBody("");
    if (orgId) {
      createNotification({
        userId: peerId,
        orgId,
        type: "message",
        title: peer?.full_name || peer?.email || "Новое сообщение",
        body: body.trim() || "Файл",
        link: "/chat",
      }).catch(() => {});
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 15 МБ)");
      return;
    }
    setBusy(true);
    const path = `${me}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file);
    if (error) {
      setBusy(false);
      toast.error("Ошибка загрузки", { description: error.message });
      return;
    }
    setBusy(false);
    await send({ url: path, name: file.name, size: file.size, mime: file.type });
  };

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {peer ? (
            peer.id === peerId && peer.full_name === undefined ? (
              <Headphones className="h-4 w-4" />
            ) : (
              initials(peer.full_name, peer.email)
            )
          ) : (
            "?"
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {peer?.full_name || peer?.email}
          </div>
          <div className="text-[11px] text-muted-foreground">Личный диалог</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-sm text-center text-xs text-muted-foreground">
            Сообщений пока нет. Начните диалог.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} mine={m.sender_id === me} />
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-border p-3"
      >
        <input ref={fileRef} type="file" hidden onChange={onPickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="ring-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
          aria-label="Прикрепить файл"
          title="Прикрепить файл"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Введите сообщение… (Enter — отправить, Shift+Enter — перенос)"
          className="ring-focus min-h-[36px] max-h-32 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="ring-focus inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Отправить
        </button>
      </form>
    </>
  );
}

function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  const text = m.body || m.content;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
          mine
            ? "bg-brand text-brand-foreground"
            : "bg-surface text-foreground border border-border"
        }`}
      >
        {text && (
          <div className="whitespace-pre-wrap break-words">{text}</div>
        )}
        {m.attachment_url && <Attachment m={m} mine={mine} />}
        <div
          className={`mt-1 flex items-center gap-1 text-[10px] ${
            mine ? "text-brand-foreground/70" : "text-muted-foreground"
          }`}
        >
          <span>
            {new Date(m.inserted_at || m.created_at).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {mine && (
            <span className="inline-flex">
              {m.read_at ? (
                <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Attachment({ m, mine }: { m: Message; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!m.attachment_url) return;
    let active = true;
    const { data } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(m.attachment_url);
    if (active && data?.publicUrl) setUrl(data.publicUrl);
    return () => {
      active = false;
    };
  }, [m.attachment_url]);

  const isImage = m.attachment_mime?.startsWith("image/");
  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img
          src={url}
          alt={m.attachment_name ?? ""}
          className="max-h-64 rounded-md border border-border object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        mine
          ? "border-brand-foreground/30 bg-brand-foreground/10"
          : "border-border bg-background"
      }`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{m.attachment_name ?? "файл"}</span>
      {m.attachment_size != null && (
        <span className="shrink-0 text-[10px] opacity-70">
          {(m.attachment_size / 1024).toFixed(0)} КБ
        </span>
      )}
    </a>
  );
}
