import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ShieldAlert, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/suspended")({
  head: () => ({ meta: [{ title: "Доступ ограничен — Канбан" }] }),
  component: SuspendedPage,
});

function SuspendedPage() {
  const { signOut, isSuspended, session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!isSuspended) return <Navigate to="/" replace />;

  const expired = profile?.paid_until && new Date(profile.paid_until) < new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Доступ ограничен</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {expired
            ? "Срок действия вашей подписки истёк. Обратитесь к администратору организации."
            : "Ваша учётная запись приостановлена. Обратитесь к администратору организации."}
        </p>

        <div className="surface-card mt-6 flex items-center gap-3 p-4 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <div className="font-semibold text-foreground">Восстановите доступ</div>
            <div className="text-muted-foreground">
              Свяжитесь с администратором, чтобы продлить подписку и продолжить работу с досками и календарём.
            </div>
          </div>
        </div>

        <button
          onClick={signOut}
          className="ring-focus mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </div>
    </div>
  );
}
