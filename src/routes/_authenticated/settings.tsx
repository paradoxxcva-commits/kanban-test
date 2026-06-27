import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Palette, Bell, Globe } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки — Планка" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, hasRole } = useAuth();

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "dark");
  const [notifications, setNotifications] = useState(() => localStorage.getItem("notifications") !== "false");
  const [busy, setBusy] = useState(false);

  const applyTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
    document.documentElement.classList.toggle("light", value === "light");
  };

  const toggleNotifications = async () => {
    const next = !notifications;
    if (next && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Браузер запретил уведомления");
        return;
      }
    }
    setNotifications(next);
    localStorage.setItem("notifications", String(next));
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Настройки</h1>
          <p className="mt-1 text-sm text-muted-foreground">Управление интерфейсом и уведомлениями.</p>
        </div>

        <section className="surface-card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Тема оформления</h2>
          </div>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className={`rounded-md px-4 py-2 text-xs font-medium transition-colors ${
                  theme === t
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t === "dark" ? "Тёмная" : t === "light" ? "Светлая" : "Системная"}
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Уведомления</h2>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={notifications}
              onChange={toggleNotifications}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm text-foreground">Показывать всплывающие уведомления</span>
          </label>
        </section>

        <section className="surface-card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Информация</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{profile?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Роль</dt>
              <dd className="font-medium text-foreground">
                {hasRole("super_admin")
                  ? "Системный администратор"
                  : hasRole("admin")
                    ? "Администратор"
                    : "Сотрудник"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
