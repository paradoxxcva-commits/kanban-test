import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageSquare, Loader2, Headphones, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  getPocketBase,
  pbGetMessages,
  pbSendMessage,
  pbSubscribeToMessages,
  pbMarkAsRead,
  setPocketBaseAuth,
  type PBMessage,
} from "@/lib/pocketbase";

export const Route = createFileRoute("/_authenticated/chat-pb")({
  head: () => ({ meta: [{ title: "Чат (PB) — Планка" }] }),
  component: ChatPBPage,
});

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
  org_name?: string | null;
}

function initials(name: string | null | undefined, email: string) {
  const src = (name && name.trim()) || email || "?";
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function ChatPBPage() {
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const pb = getPocketBase();
      const token = pb.authStore.token;
      if (!token) {
        setPocketBaseAuth(user.id);
      }
    }
  }, [user]);

  const { data: orgMembers } = useQuery({
    queryKey: ["org-members-pb", profile?.org_id],
    queryFn: async () => {
      if (!profile?.org_id) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("org_id", profile.org_id)
        .neq("id", user!.id)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as OrgUser[];
    },
    enabled: !!profile?.org_id && !!user,
  });

  const contacts = useMemo(() => orgMembers ?? [], [orgMembers]);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  PocketBase чат
                </div>
                <h2 className="text-sm font-semibold text-foreground">Собеседники</h2>
              </div>
              <a
                href="/pb/"
                target="_blank"
                rel="noopener noreferrer"
                className="ring-focus flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Открыть PocketBase Admin UI"
              >
                <ExternalLink className="h-3 w-3" />
                Admin
              </a>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent ${
                  selected === c.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(c.full_name, c.email)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {c.full_name || c.email}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.email}</div>
                </div>
              </button>
            ))}
            {contacts.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                Нет собеседников
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected && user ? (
            <PBChatThread me={user.id} peerId={selected} contacts={contacts} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="text-sm">Выберите собеседника для начала диалога</p>
              <p className="text-xs">
                PocketBase Admin UI:{" "}
                <a href="/pb/" target="_blank" className="text-brand underline">
                  открыть
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PBChatThread({
  me,
  peerId,
  contacts,
}: {
  me: string;
  peerId: string;
  contacts: OrgUser[];
}) {
  const peer = contacts.find((c) => c.id === peerId);
  const [messages, setMessages] = useState<PBMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pbGetMessages(me, peerId)
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
          setLoading(false);
        }
      })
      .catch((err) => {
        toast.error("Ошибка загрузки сообщений", { description: err.message });
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [me, peerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const unsub = pbSubscribeToMessages(me, peerId, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, [me, peerId]);

  useEffect(() => {
    const unread = messages.filter(
      (m) => m.sender_id === peerId && m.recipient_id === me && !m.read_at
    );
    unread.forEach((m) => pbMarkAsRead(m.id).catch(() => {}));
  }, [messages, me, peerId]);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await pbSendMessage({
        senderId: me,
        recipientId: peerId,
        body: body.trim(),
      });
      setBody("");
    } catch (err: any) {
      toast.error("Не удалось отправить", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {peer ? initials(peer.full_name, peer.email) : <Headphones className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {peer?.full_name || peer?.email}
          </div>
          <div className="text-[11px] text-muted-foreground">PocketBase чат</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-sm text-center text-xs text-muted-foreground">
            Сообщений пока нет. Начните диалог.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_id === me ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                  m.sender_id === me
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className="mt-1 text-[10px] opacity-60">
                  {new Date(m.created).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-border px-5 py-3"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Введите сообщение..."
          className="ring-focus min-h-[40px] flex-1 resize-none rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          rows={1}
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="ring-focus flex h-9 w-9 items-center justify-center rounded-md bg-brand text-brand-foreground transition hover:bg-brand-glow disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}
