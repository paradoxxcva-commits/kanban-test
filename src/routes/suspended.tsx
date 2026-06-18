import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Sparkles, Mail } from "lucide-react";

export const Route = createFileRoute("/suspended")({
  head: () => ({
    meta: [
      { title: "Доступ ограничен — Канбан" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuspendedPage,
});

function SuspendedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Доступ ограничен</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Срок действия вашей подписки истёк. Для продолжения работы обратитесь к администратору
            организации или продлите подписку.
          </p>
        </div>

        <div className="surface-card flex items-center gap-3 p-4 text-left">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-xs">
            <div className="text-muted-foreground">Администратор организации</div>
            <div className="truncate font-medium text-foreground">admin@your-org.ru</div>
          </div>
          <button className="ring-focus rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent">
            Написать
          </button>
        </div>

        {/* Рекламный блок — централизованный для бесплатного / истёкшего тарифа */}
        <div className="surface-card relative overflow-hidden border-brand/40 bg-gradient-to-br from-surface to-accent/30 p-6">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
              Реклама
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">Продлите доступ со скидкой 20%</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Безлимитные доски, синхронизация с Яндекс.Календарём и приоритетная поддержка для вашей
            команды.
          </p>
          <button className="ring-focus mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-glow">
            Перейти к тарифам
          </button>
        </div>

        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.href = "/login";
          }}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
