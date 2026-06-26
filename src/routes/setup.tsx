import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { bootstrapFirstSuperAdmin, superAdminCheck } from "@/lib/admin.functions";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Первичная настройка — Планка" }] }),
  component: SetupPage,
});

function SetupPage() {
  const check = useServerFn(superAdminCheck);
  const bootstrap = useServerFn(bootstrapFirstSuperAdmin);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["sa-check"], queryFn: () => check() });

  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [busy, setBusy] = useState(false);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;
  if (data?.exists) return <Navigate to="/login" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrap({ data: form });
      toast.success("Системный администратор создан. Войдите в систему.");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error("Ошибка", { description: err.message });
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Первичная настройка</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте учётную запись системного администратора. Доступно только один раз.
          </p>
        </div>
        <form onSubmit={onSubmit} className="surface-card space-y-3 p-6">
          <input
            required
            placeholder="ФИО"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Пароль (мин. 8 символов)"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            className="ring-focus inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand-glow disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать администратора
          </button>
        </form>
      </div>
    </div>
  );
}
