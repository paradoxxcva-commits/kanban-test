import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { KanbanSquare, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Вход — Канбан" },
      { name: "description", content: "Войдите в систему управления задачами." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error("Не удалось войти", { description: "Проверьте логин и пароль." });
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-brand">
            <KanbanSquare className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Канбан</h1>
          <p className="mt-1 text-sm text-muted-foreground">Войдите в свою рабочую область</p>
        </div>

        <form className="surface-card space-y-4 p-6 shadow-elevated" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium text-foreground">
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.ru"
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="ring-focus block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="ring-focus mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Войти в систему
          </button>

          <p className="border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
            Регистрация закрыта. Учётные данные выдаёт администратор организации.
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Канбан · Безопасный вход через зашифрованное соединение
        </p>
      </div>
    </div>
  );
}
