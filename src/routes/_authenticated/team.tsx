import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  Search,
  Power,
  X,
  Calendar,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import {
  listAllUsers,
  listOrganizations,
  createUser,
  deleteUser,
  updateUserActive,
  updateUserOrg,
  updateUserPaidUntil,
  setUserRoles,
  adminSetUserPassword,
} from "@/lib/admin.functions";

type Role = "super_admin" | "admin" | "user";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Сис.админ",
  admin: "Админ орг.",
  user: "Сотрудник",
};

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Команда — Планка" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  if (!hasRole("super_admin")) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Управление командой
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Команда</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Приглашения, роли, организации, подписки и пароли участников.
            </p>
          </div>
        </header>

        <TeamPanel />
      </div>
    </AppShell>
  );
}

function TeamPanel() {
  const fetchUsers = useServerFn(listAllUsers);
  const fetchOrgs = useServerFn(listOrganizations);
  const delU = useServerFn(deleteUser);
  const setActive = useServerFn(updateUserActive);
  const setOrg = useServerFn(updateUserOrg);
  const setPaid = useServerFn(updateUserPaidUntil);

  const { data: users, refetch, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
  });
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: () => fetchOrgs() });

  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState<{ id: string; label: string } | null>(null);
  const [rolesUser, setRolesUser] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return (users ?? []).filter((u: any) => {
      if (orgFilter && (u.org_id ?? "") !== orgFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, orgFilter]);

  const onToggleActive = async (u: any) => {
    try {
      await setActive({ data: { userId: u.id, isActive: !u.is_active } });
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const onChangeOrg = async (u: any, orgId: string) => {
    try {
      await setOrg({ data: { userId: u.id, orgId: orgId || null } });
      toast.success("Организация обновлена");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const extend = async (u: any, months: number) => {
    const base = u.paid_until && new Date(u.paid_until) > new Date() ? new Date(u.paid_until) : new Date();
    base.setMonth(base.getMonth() + months);
    try {
      await setPaid({ data: { userId: u.id, paidUntil: base.toISOString() } });
      toast.success(`Подписка +${months} мес.`);
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const onDelete = async (u: any) => {
    if (!confirm(`Удалить пользователя ${u.email}?`)) return;
    try {
      await delU({ data: { userId: u.id } });
      toast.success("Удалён");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

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
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="ring-focus rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="">Все организации</option>
          {(orgs ?? []).map((o: any) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setInviteOpen(true)}
          className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand-glow"
        >
          <Plus className="h-3.5 w-3.5" /> Пригласить участника
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Пользователь</th>
              <th className="px-3 py-2 text-left font-medium">Организация</th>
              <th className="px-3 py-2 text-left font-medium">Роли</th>
              <th className="px-3 py-2 text-left font-medium">Подписка до</th>
              <th className="px-3 py-2 text-left font-medium">Активен</th>
              <th className="px-3 py-2 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Загрузка…
                </td>
              </tr>
            )}
            {filtered.map((u: any) => {
              const expired = u.paid_until && new Date(u.paid_until) < new Date();
              return (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <div className="text-foreground">{u.full_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={u.org_id ?? ""}
                      onChange={(e) => onChangeOrg(u, e.target.value)}
                      className="ring-focus rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {(orgs ?? []).map((o: any) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setRolesUser(u)}
                      className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-left text-[11px] hover:bg-accent"
                    >
                      {(u.roles ?? []).length === 0 && (
                        <span className="text-muted-foreground">нет</span>
                      )}
                      {(u.roles ?? []).map((r: Role) => (
                        <span
                          key={r}
                          className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
                        >
                          {ROLE_LABEL[r] ?? r}
                        </span>
                      ))}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div
                      className={
                        expired ? "text-destructive" : u.paid_until ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {u.paid_until
                        ? new Date(u.paid_until).toLocaleDateString("ru-RU")
                        : "не задано"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[1, 3, 6, 12].map((m) => (
                        <button
                          key={m}
                          onClick={() => extend(u, m)}
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] hover:bg-accent"
                        >
                          +{m === 12 ? "1 год" : `${m} мес`}
                        </button>
                      ))}
                      {u.paid_until && (
                        <button
                          onClick={async () => {
                            try {
                              await setPaid({ data: { userId: u.id, paidUntil: null } });
                              refetch();
                            } catch (err: any) {
                              toast.error("Ошибка", { description: err.message });
                            }
                          }}
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                        >
                          <Calendar className="inline h-3 w-3" /> сброс
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => onToggleActive(u)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                        u.is_active
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {u.is_active ? "активен" : "выключен"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setPwdUser({ id: u.id, label: u.full_name || u.email })
                        }
                        title="Сменить пароль"
                        className="ring-focus rounded-md border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(u)}
                        title="Удалить"
                        className="ring-focus rounded-md border border-border bg-surface p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <InviteDialog
          orgs={orgs ?? []}
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            setInviteOpen(false);
            refetch();
          }}
        />
      )}

      {pwdUser && (
        <PasswordDialog
          userId={pwdUser.id}
          label={pwdUser.label}
          onClose={() => setPwdUser(null)}
        />
      )}

      {rolesUser && (
        <RolesDialog
          user={rolesUser}
          onClose={() => setRolesUser(null)}
          onSaved={() => {
            setRolesUser(null);
            refetch();
          }}
        />
      )}
    </section>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="surface-card w-full max-w-md p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="ring-focus rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InviteDialog({
  orgs,
  onClose,
  onCreated,
}: {
  orgs: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const create = useServerFn(createUser);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    orgId: "",
    role: "user" as Role,
  });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Пароль ≥ 8 символов");
    setBusy(true);
    try {
      await create({
        data: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          orgId: form.orgId || null,
          role: form.role,
        },
      });
      toast.success("Пользователь создан");
      onCreated();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Modal title="Пригласить участника" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Labeled label="ФИО">
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Labeled>
        <Labeled label="Email">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Labeled>
        <Labeled label="Временный пароль (мин. 8)">
          <input
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Роль">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              <option value="user">Сотрудник</option>
              <option value="admin">Админ орг.</option>
              <option value="super_admin">Сис.админ</option>
            </select>
          </Labeled>
          <Labeled label="Организация">
            <select
              value={form.orgId}
              onChange={(e) => setForm({ ...form, orgId: e.target.value })}
              className="ring-focus block w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              <option value="">— без организации —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Labeled>
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
            Создать
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordDialog({
  userId,
  label,
  onClose,
}: {
  userId: string;
  label: string;
  onClose: () => void;
}) {
  const setPwd = useServerFn(adminSetUserPassword);
  const [pwd, setPwdValue] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Пароль ≥ 8 символов");
    setBusy(true);
    try {
      await setPwd({ data: { userId, newPassword: pwd } });
      toast.success("Пароль обновлён");
      onClose();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Modal title={`Сменить пароль: ${label}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Labeled label="Новый пароль (мин. 8)">
          <input
            autoFocus
            required
            minLength={8}
            value={pwd}
            onChange={(e) => setPwdValue(e.target.value)}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Labeled>
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Установить
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RolesDialog({
  user,
  onClose,
  onSaved,
}: {
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(setUserRoles);
  const [selected, setSelected] = useState<Role[]>(((user.roles ?? []) as Role[]).length ? user.roles : ["user"]);
  const [busy, setBusy] = useState(false);

  const toggle = (r: Role) => {
    setSelected((cur) =>
      cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return toast.error("Выберите хотя бы одну роль");
    setBusy(true);
    try {
      await save({
        data: { userId: user.id, roles: selected, orgId: user.org_id ?? null },
      });
      toast.success("Роли обновлены");
      onSaved();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <Modal title={`Роли: ${user.full_name || user.email}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          {(["super_admin", "admin", "user"] as Role[]).map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.includes(r)}
                onChange={() => toggle(r)}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              <span className="text-foreground">{ROLE_LABEL[r]}</span>
              <span className="text-[11px] text-muted-foreground">({r})</span>
            </label>
          ))}
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
