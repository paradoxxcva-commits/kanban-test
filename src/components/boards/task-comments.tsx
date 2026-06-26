import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { listComments, createComment, deleteComment, getAttachmentUrl, type CommentRow } from "@/lib/comments-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function getLastReadComment(taskId: string): string | null {
  try {
    return localStorage.getItem(`comment_read_${taskId}`);
  } catch {
    return null;
  }
}

function setLastReadComment(taskId: string) {
  try {
    localStorage.setItem(`comment_read_${taskId}`, new Date().toISOString());
  } catch {}
}

export function getUnreadCommentCount(taskId: string, comments: CommentRow[], userId: string): number {
  const lastRead = getLastReadComment(taskId);
  if (!lastRead) return comments.filter((c) => c.author_id !== userId).length;
  const ts = new Date(lastRead).getTime();
  return comments.filter((c) => c.author_id !== userId && new Date(c.created_at).getTime() > ts).length;
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function TaskComments({ taskId }: { taskId: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => listComments(taskId),
  });

  // Mark comments as read when opened
  useEffect(() => {
    if (comments.length > 0 && user) {
      setLastReadComment(taskId);
      qc.invalidateQueries({ queryKey: ["unreadComments"] });
    }
  }, [comments.length, taskId, user, qc]);

  const createMut = useMutation({
    mutationFn: createComment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      qc.invalidateQueries({ queryKey: ["commentCounts"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      qc.invalidateQueries({ queryKey: ["commentCounts"] });
    },
  });

  const uploadAndComment = async (file: File) => {
    if (!user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 25 МБ)");
      return;
    }
    setBusy(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: uploadErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file);
      if (uploadErr) throw new Error(uploadErr.message);

      await createMut.mutateAsync({
        task_id: taskId,
        body: body.trim() || null,
        author_id: user.id,
        attachment_url: path,
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_mime: file.type,
      });
      setBody("");
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadAndComment(file);
  };

  const onSubmit = async () => {
    if (!body.trim() || !user) return;
    setBusy(true);
    try {
      await createMut.mutateAsync({
        task_id: taskId,
        body: body.trim(),
        author_id: user.id,
      });
      setBody("");
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Комментарии ({comments.length})
      </div>

      {/* Comment list */}
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {isLoading && (
          <div className="text-xs text-muted-foreground">Загрузка…</div>
        )}
        {!isLoading && comments.length === 0 && (
          <div className="text-xs text-muted-foreground">Пока нет комментариев</div>
        )}
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            isOwn={c.author_id === user?.id}
            onDelete={() => {
              if (confirm("Удалить комментарий?")) deleteMut.mutate(c.id);
            }}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ring-focus inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-2 text-muted-foreground hover:text-foreground"
          title="Прикрепить файл"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Написать комментарий…"
          rows={1}
          className="ring-focus min-h-[36px] max-h-24 flex-1 resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={busy || (!body.trim())}
          className="px-3"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function CommentItem({
  comment: c,
  isOwn,
  onDelete,
}: {
  comment: CommentRow;
  isOwn: boolean;
  onDelete: () => void;
}) {
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorEmail, setAuthorEmail] = useState("");

  // Fetch author info
  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", c.author_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAuthorName(data.full_name);
          setAuthorEmail(data.email);
        }
      });
  }, [c.author_id]);

  const attachmentUrl = c.attachment_url ? getAttachmentUrl(c.attachment_url) : null;

  return (
    <div className="group flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
        {initials(authorName, authorEmail)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            {authorName || authorEmail || "Пользователь"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(c.created_at).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOwn && (
            <button
              onClick={onDelete}
              className="ml-auto opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        {c.body && (
          <div className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{c.body}</div>
        )}
        {attachmentUrl && (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent"
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[200px]">{c.attachment_name}</span>
            {c.attachment_size != null && (
              <span className="text-muted-foreground">({formatSize(c.attachment_size)})</span>
            )}
          </a>
        )}
      </div>
    </div>
  );
}
