import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import {
  changeOwnPassword,
  adminSetUserPassword,
  listAllUsers,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Аккаунт — Канбан" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { profile, user, hasRole } = useAuth();
  const roleLabel = hasRole("super_admin")
    ? "Системный администратор"
    : hasRole("admin")
      ? "Администратор"
      : "Сотрудник";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5" /> Профиль и безопасность
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Аккаунт</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Управление личными данными и сменой пароля.
          </p>
        </header>

        <section className="surface-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Профиль</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Имя" value={profile?.full_name || "—"} />
            <Field label="Email" value={user?.email || "—"} />
            <Field label="Роль" value={roleLabel} />
            <Field
              label="Подписка до"
              value={
                profile?.paid_until
                  ? new Date(profile.paid_until).toLocaleDateString("ru-RU")
                  : "—"
              }
            />
          </dl>
        </section>

        <OwnPasswordPanel />

        {hasRole("super_admin") && <AdminPasswordPanel />}
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function OwnPasswordPanel() {
  const change = useServerFn(changeOwnPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Пароль должен быть не короче 8 символов");
      return;
    }
    if (next !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await change({ data: { currentPassword: current, newPassword: next } });
      toast.success("Пароль обновлён");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold text-foreground">Смена своего пароля</h2>
      </div>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Текущий пароль"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          required
          className="sm:col-span-2"
        />
        <Input
          label="Новый пароль (мин. 8)"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          required
          minLength={8}
        />
        <Input
          label="Повторите новый пароль"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          required
          minLength={8}
        />
        <div className="sm:col-span-2">
          <button
            disabled={busy}
            className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Сменить пароль
          </button>
        </div>
      </form>
    </section>
  );
}

function AdminPasswordPanel() {
  const fetchUsers = useServerFn(listAllUsers);
  const setPwd = useServerFn(adminSetUserPassword);
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const [userId, setUserId] = useState("");
  const [pwd, setPwdValue] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return toast.error("Выберите пользователя");
    if (pwd.length < 8) return toast.error("Пароль должен быть не короче 8 символов");
    setBusy(true);
    try {
      await setPwd({ data: { userId, newPassword: pwd } });
      toast.success("Пароль пользователя обновлён");
      setPwdValue("");
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <section className="surface-card border-brand/30 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold text-foreground">
          Сменить пароль любому пользователю
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Доступно только системному администратору. Текущий пароль не требуется.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Пользователь
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isLoading}
            className="ring-focus mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— выберите —</option>
            {(users ?? []).map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.full_name ? `${u.full_name} (${u.email})` : u.email}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Новый пароль (мин. 8)"
          type="text"
          value={pwd}
          onChange={setPwdValue}
          required
          minLength={8}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <button
            disabled={busy}
            className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Установить пароль
          </button>
        </div>
      </form>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  className,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className={className}>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ring-focus mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
