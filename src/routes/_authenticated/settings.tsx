import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Palette, Bell, Globe } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications-api";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки — Планка" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, hasRole } = useAuth();

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "dark");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs).catch(() => {});
  }, []);

  const applyTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
    document.documentElement.classList.toggle("light", value === "light");
  };

  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await updateNotificationPrefs({ [key]: next[key] });
    } catch {
      setPrefs(prefs);
      toast.error("Ошибка сохранения");
    }
  };

  const toggleBrowserPush = async () => {
    if (!prefs) return;
    if (!prefs.browser_push && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Браузер запретил уведомления");
        return;
      }
    }
    await togglePref("browser_push");
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
          {prefs ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Сообщения</p>
                  <p className="text-xs text-muted-foreground">Уведомления о новых сообщениях в чате</p>
                </div>
                <Switch checked={prefs.message_enabled} onCheckedChange={() => togglePref("message_enabled")} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Задачи</p>
                  <p className="text-xs text-muted-foreground">Назначение задач и приближение срока</p>
                </div>
                <Switch checked={prefs.task_enabled} onCheckedChange={() => togglePref("task_enabled")} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Комментарии</p>
                  <p className="text-xs text-muted-foreground">Новые комментарии к вашим задачам</p>
                </div>
                <Switch checked={prefs.comment_enabled} onCheckedChange={() => togglePref("comment_enabled")} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Напоминания</p>
                  <p className="text-xs text-muted-foreground">Напоминания о сроках задач</p>
                </div>
                <Switch checked={prefs.reminder_enabled} onCheckedChange={() => togglePref("reminder_enabled")} />
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Всплывающие уведомления</p>
                    <p className="text-xs text-muted-foreground">Browser push когда вкладка скрыта</p>
                  </div>
                  <Switch checked={prefs.browser_push} onCheckedChange={toggleBrowserPush} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка...
            </div>
          )}
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
