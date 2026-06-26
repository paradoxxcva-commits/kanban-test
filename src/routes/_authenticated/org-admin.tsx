import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2, Loader2, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { listOrgMembers, inviteOrgMember, removeOrgMember } from "@/lib/org-admin.functions";

export const Route = createFileRoute("/_authenticated/org-admin")({
  head: () => ({ meta: [{ title: "Админ организации — Планка" }] }),
  component: OrgAdminPage,
});

function OrgAdminPage() {
  const { hasRole, loading, profile } = useAuth();
  if (loading) return null;
  if (!hasRole("admin")) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Управление организацией
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Участники организации
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Управление участниками вашей организации.
            </p>
          </div>
        </header>
        <OrgMembersPanel orgId={profile?.org_id} />
      </div>
    </AppShell>
  );
}

function OrgMembersPanel({ orgId }: { orgId: string | null | undefined }) {
  const fetchMembers = useServerFn(listOrgMembers);
  const delMember = useServerFn(removeOrgMember);

  const { data: members, refetch, isLoading } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchMembers({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = (members ?? []).filter((u: any) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q)
    );
  });

  const onRemove = async (u: any) => {
    if (!confirm(`Удалить ${u.full_name || u.email} из организации?`)) return;
    try {
      await delMember({ data: { orgId: orgId!, userId: u.id } });
      toast.success("Участник удалён");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  if (!orgId) {
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">
        Вы не привязаны к организации.
      </div>
    );
  }

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или email"
            className="ring-focus w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setInviteOpen(true)}
          className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand-glow"
        >
          <Plus className="h-3.5 w-3.5" /> Пригласить участника
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Пользователь</th>
              <th className="px-3 py-2 text-left font-medium">Роль</th>
              <th className="px-3 py-2 text-left font-medium">Статус</th>
              <th className="px-3 py-2 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Загрузка…
                </td>
              </tr>
            )}
            {filtered.map((u: any) => (
              <tr key={u.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <div className="text-foreground">{u.full_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                    {(u.roles ?? [])[0] === "admin" ? "Админ" : "Сотрудник"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[11px] ${u.is_active ? "text-success" : "text-destructive"}`}
                  >
                    {u.is_active ? "активен" : "выключен"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => onRemove(u)}
                      title="Удалить из организации"
                      className="ring-focus rounded-md border border-border bg-surface p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <InviteOrgMemberDialog
          orgId={orgId}
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            setInviteOpen(false);
            refetch();
          }}
        />
      )}
    </section>
  );
}

function InviteOrgMemberDialog({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const invite = useServerFn(inviteOrgMember);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Пароль ≥ 8 символов");
    setBusy(true);
    try {
      await invite({
        data: {
          orgId,
          email: form.email,
          password: form.password,
          fullName: form.fullName,
        },
      });
      toast.success("Участник добавлен");
      onCreated();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Пригласить участника</h3>
          <button
            onClick={onClose}
            className="ring-focus rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">ФИО</div>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Email</div>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Пароль (мин. 8)</div>
            <input
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="ring-focus rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent"
            >
              Отмена
            </button>
            <button
              disabled={busy}
              className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
