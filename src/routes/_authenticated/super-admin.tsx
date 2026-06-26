import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import {
  listAllUsers,
  listOrganizations,
  createOrganization,
  deleteOrganization,
  createUser,
  deleteUser,
  updateUserPaidUntil,
  updateUserActive,
  updateUserOrg,
} from "@/lib/admin.functions";
import { Plus, Trash2, ShieldCheck, Calendar, Power, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Системный администратор — Планка" }] }),
  component: SuperAdminPage,
});

function SuperAdminPage() {
  const { hasRole } = useAuth();
  if (!hasRole("super_admin")) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Управление системой
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Системный администратор
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление организациями, пользователями и сроком подписки.
          </p>
        </header>

        <OrganizationsPanel />
        <UsersPanel />
      </div>
    </AppShell>
  );
}

function OrganizationsPanel() {
  const fetchOrgs = useServerFn(listOrganizations);
  const createOrgFn = useServerFn(createOrganization);
  const deleteOrgFn = useServerFn(deleteOrganization);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["orgs"], queryFn: () => fetchOrgs() });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createOrgFn({ data: { name } });
      toast.success("Организация создана");
      setName("");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  const onDel = async (id: string) => {
    if (!confirm("Удалить организацию вместе со всеми её данными?")) return;
    try {
      await deleteOrgFn({ data: { id } });
      toast.success("Удалено");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  return (
    <section className="surface-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Организации</h2>
      <form onSubmit={onAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="ring-focus block rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            placeholder="ООО «Пример»"
          />
        </div>
        <button
          disabled={busy}
          className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Добавить
        </button>
      </form>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Название</th>
              <th className="px-3 py-2 text-left font-medium">Слаг</th>
              <th className="px-3 py-2 text-left font-medium">Создана</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Загрузка…</td></tr>
            )}
            {(data ?? []).map((o: any) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-2">{o.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{o.slug}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => onDel(o.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Нет организаций</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersPanel() {
  const fetchUsers = useServerFn(listAllUsers);
  const fetchOrgs = useServerFn(listOrganizations);
  const createU = useServerFn(createUser);
  const delU = useServerFn(deleteUser);
  const setPaid = useServerFn(updateUserPaidUntil);
  const setActive = useServerFn(updateUserActive);
  const setOrg = useServerFn(updateUserOrg);

  const { data: users, refetch, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: () => fetchOrgs() });

  const [form, setForm] = useState({ email: "", password: "", fullName: "", orgId: "", role: "user" as "user" | "admin" | "super_admin" });
  const [busy, setBusy] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createU({
        data: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          orgId: form.orgId || null,
          role: form.role,
        },
      });
      toast.success("Пользователь создан");
      setForm({ email: "", password: "", fullName: "", orgId: "", role: "user" });
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  const extend = async (userId: string, current: string | null, months: number) => {
    const base = current && new Date(current) > new Date() ? new Date(current) : new Date();
    base.setMonth(base.getMonth() + months);
    try {
      await setPaid({ data: { userId, paidUntil: base.toISOString() } });
      toast.success(`Подписка продлена на ${months} мес.`);
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const clearPaid = async (userId: string) => {
    try {
      await setPaid({ data: { userId, paidUntil: null } });
      toast.success("Срок подписки очищен");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await setActive({ data: { userId, isActive: !isActive } });
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const changeOrg = async (userId: string, orgId: string) => {
    try {
      await setOrg({ data: { userId, orgId: orgId || null } });
      toast.success("Организация обновлена");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  const onDelete = async (userId: string) => {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await delU({ data: { userId } });
      toast.success("Удалено");
      refetch();
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
  };

  return (
    <section className="surface-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Пользователи</h2>

      <form onSubmit={onCreate} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <input
          required
          placeholder="ФИО"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          className="ring-focus rounded-md border border-input bg-background px-3 py-1.5 text-sm sm:col-span-2"
        />
        <input
          required
          type="email"
          placeholder="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="ring-focus rounded-md border border-input bg-background px-3 py-1.5 text-sm sm:col-span-2"
        />
        <input
          required
          type="text"
          placeholder="пароль (мин. 8)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="ring-focus rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as any })}
          className="ring-focus rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="user">Сотрудник</option>
          <option value="admin">Админ орг.</option>
          <option value="super_admin">Сис.админ</option>
        </select>
        <select
          value={form.orgId}
          onChange={(e) => setForm({ ...form, orgId: e.target.value })}
          className="ring-focus rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:col-span-3"
        >
          <option value="">— без организации —</option>
          {(orgs ?? []).map((o: any) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button
          disabled={busy}
          className="ring-focus inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60 sm:col-span-2"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Создать пользователя
        </button>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Пользователь</th>
              <th className="px-3 py-2 text-left font-medium">Организация</th>
              <th className="px-3 py-2 text-left font-medium">Роли</th>
              <th className="px-3 py-2 text-left font-medium">Подписка до</th>
              <th className="px-3 py-2 text-left font-medium">Продлить</th>
              <th className="px-3 py-2 text-left font-medium">Активен</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">Загрузка…</td></tr>
            )}
            {(users ?? []).map((u: any) => {
              const expired = u.paid_until && new Date(u.paid_until) < new Date();
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="text-foreground">{u.full_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.org_id ?? ""}
                      onChange={(e) => changeOrg(u.id, e.target.value)}
                      className="ring-focus rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {(orgs ?? []).map((o: any) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map((r: string) => (
                        <span key={r} className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.paid_until ? (
                      <span className={expired ? "text-destructive" : "text-foreground"}>
                        {new Date(u.paid_until).toLocaleDateString("ru-RU")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">не задано</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => extend(u.id, u.paid_until, 1)} className="rounded border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent">
                        +1 мес
                      </button>
                      <button onClick={() => extend(u.id, u.paid_until, 3)} className="rounded border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent">
                        +3 мес
                      </button>
                      <button onClick={() => extend(u.id, u.paid_until, 6)} className="rounded border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent">
                        +6 мес
                      </button>
                      <button onClick={() => extend(u.id, u.paid_until, 12)} className="rounded border border-border bg-surface px-2 py-1 text-[11px] hover:bg-accent">
                        +1 год
                      </button>
                      {u.paid_until && (
                        <button onClick={() => clearPaid(u.id)} className="rounded border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">
                          <Calendar className="inline h-3 w-3" /> сброс
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(u.id, u.is_active)}
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
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onDelete(u.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {users?.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">Нет пользователей</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
