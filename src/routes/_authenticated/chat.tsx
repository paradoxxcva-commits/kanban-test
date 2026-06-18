import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Send, MessageSquare, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Чат — Канбан" }] }),
  component: ChatPage,
});

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  created_at: string;
  read_at: string | null;
}

function initials(name: string | null, email: string) {
  const src = (name && name.trim()) || email;
  return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function ChatPage() {
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

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

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Личные сообщения
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              Сотрудники организации
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!profile?.org_id && (
              <div className="p-4 text-xs text-muted-foreground">
                Вы не привязаны к организации. Обратитесь к администратору.
              </div>
            )}
            {(users ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition ${
                  selected === u.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(u.full_name, u.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{u.full_name || u.email}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{u.email}</div>
                </div>
              </button>
            ))}
            {users?.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">В организации пока только вы.</div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <ChatThread me={user.id} peerId={selected} peer={users?.find((u) => u.id === selected)} />
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

function ChatThread({ me, peerId, peer }: { me: string; peerId: string; peer?: OrgUser }) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["messages", me, peerId], [me, peerId]);
  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data as Message[]) ?? [];
    },
  });

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const ch = supabase
      .channel(`dm-${[me, peerId].sort().join("-")}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (
          (m.sender_id === me && m.recipient_id === peerId) ||
          (m.sender_id === peerId && m.recipient_id === me)
        ) {
          qc.setQueryData<Message[]>(queryKey, (prev) => (prev ? [...prev, m] : [m]));
        }
      })
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
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 25 МБ)");
      return;
    }
    setBusy(true);
    const path = `${me}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
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
          {peer ? initials(peer.full_name, peer.email) : "?"}
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
          disabled={busy || (!body.trim())}
          className="ring-focus inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Отправить
        </button>
      </form>
    </>
  );
}

function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
          mine
            ? "bg-brand text-brand-foreground"
            : "bg-surface text-foreground border border-border"
        }`}
      >
        {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
        {m.attachment_url && <Attachment m={m} mine={mine} />}
        <div className={`mt-1 text-[10px] ${mine ? "text-brand-foreground/70" : "text-muted-foreground"}`}>
          {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
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
    supabase.storage
      .from("chat-attachments")
      .createSignedUrl(m.attachment_url, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [m.attachment_url]);

  const isImage = m.attachment_mime?.startsWith("image/");
  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={url} alt={m.attachment_name ?? ""} className="max-h-64 rounded-md border border-border object-cover" />
      </a>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        mine ? "border-brand-foreground/30 bg-brand-foreground/10" : "border-border bg-background"
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
