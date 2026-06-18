import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanSquare, CheckCircle2, Clock, Users, TrendingUp, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TasksChart } from "@/components/dashboard/tasks-chart";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Обзор — Канбан" },
      { name: "description", content: "Сводка по задачам, доскам и активности команды." },
    ],
  }),
  component: DashboardPage,
});

interface Stat {
  label: string;
  value: string;
  delta: string;
  icon: typeof KanbanSquare;
  tone: "brand" | "success" | "muted";
}

function StatCard({ stat }: { stat: Stat }) {
  const toneClass =
    stat.tone === "brand"
      ? "bg-brand/15 text-brand"
      : stat.tone === "success"
        ? "bg-success/15 text-success"
        : "bg-accent text-muted-foreground";
  return (
    <div className="surface-card p-5 shadow-card transition hover:border-border/80">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClass}`}>
          <stat.icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] text-muted-foreground">{stat.delta}</span>
      </div>
      <div className="mt-4">
        <div className="text-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {stat.value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { profile, user } = useAuth();

  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [boards, openTasks, closedTasks, members] = await Promise.all([
        supabase.from("boards").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .not("completed_at", "is", null)
          .gte("completed_at", since30),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        boards: boards.count ?? 0,
        open: openTasks.count ?? 0,
        closed: closedTasks.count ?? 0,
        members: members.count ?? 0,
      };
    },
  });

  const stats: Stat[] = [
    { label: "Активные доски", value: String(counts?.boards ?? "—"), delta: "по организации", icon: KanbanSquare, tone: "brand" },
    { label: "Открытые задачи", value: String(counts?.open ?? "—"), delta: "в работе", icon: Clock, tone: "muted" },
    { label: "Закрыто за месяц", value: String(counts?.closed ?? "—"), delta: "за 30 дн.", icon: CheckCircle2, tone: "success" },
    { label: "Участников", value: String(counts?.members ?? "—"), delta: "в организации", icon: Users, tone: "muted" },
  ];

  const greeting = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "коллега";

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Рабочее пространство
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Добро пожаловать, {greeting}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Сводка по задачам и доскам вашей организации.
            </p>
          </div>
          <button
            type="button"
            className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-glow"
          >
            <Plus className="h-4 w-4" />
            Создать доску
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="surface-card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Активность</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Лента активности появится, когда команда начнёт работать с задачами на досках.
            </p>
          </section>

          <section className="surface-card p-5">
            <div className="text-sm font-semibold text-foreground">Быстрые действия</div>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div>• Создайте первую доску</div>
              <div>• Пригласите коллег (через администратора)</div>
              <div>• Подключите календарь iCal</div>
            </div>
          </section>
        </div>

        <TasksChart />
      </div>
    </AppShell>
  );
}
