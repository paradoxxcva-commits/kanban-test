import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanSquare, CheckCircle2, Clock, Users, TrendingUp, Plus, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { OrgGuard } from "@/components/layout/org-selector";
import { TasksChart } from "@/components/dashboard/tasks-chart";
import { PriorityChart } from "@/components/dashboard/priority-chart";
import { WorkloadChart } from "@/components/dashboard/workload-chart";
import { CompletionChart } from "@/components/dashboard/completion-chart";
import { useState } from "react";

type AnyClient = any;

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Обзор — Планка" },
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
  tone: "brand" | "success" | "muted" | "danger";
}

function StatCard({ stat }: { stat: Stat }) {
  const toneClass =
    stat.tone === "brand"
      ? "bg-brand/15 text-brand"
      : stat.tone === "success"
        ? "bg-success/15 text-success"
        : stat.tone === "danger"
          ? "bg-destructive/15 text-destructive"
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
  const { profile, user, hasRole } = useAuth();
  const { selectedOrgId, isSuperAdmin } = useOrg();
  const canCreateBoard = hasRole("admin") || hasRole("super_admin");
  const [period, setPeriod] = useState(30);

  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts", selectedOrgId],
    queryFn: async () => {
      const client = supabase as AnyClient;
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

      let boardsQ = supabase.from("boards").select("id", { count: "exact", head: true });
      let openTasksQ = supabase.from("tasks").select("id", { count: "exact", head: true }).is("completed_at", null).is("archived_at", null);
      let closedTasksQ = supabase.from("tasks").select("id", { count: "exact", head: true }).not("completed_at", "is", null).gte("completed_at", since30).is("archived_at", null);
      let membersQ = supabase.from("profiles").select("id", { count: "exact", head: true });

      if (isSuperAdmin && selectedOrgId) {
        boardsQ = boardsQ.eq("org_id", selectedOrgId);
        // For tasks, we need to filter by board's org_id — use a join
        openTasksQ = openTasksQ.eq("boards.org_id", selectedOrgId);
        closedTasksQ = closedTasksQ.eq("boards.org_id", selectedOrgId);
        membersQ = membersQ.eq("org_id", selectedOrgId);
      }

      const [boards, openTasks, closedTasks, members, overdue] = await Promise.all([
        boardsQ,
        openTasksQ,
        closedTasksQ,
        membersQ,
        client.rpc("overdue_tasks_count", isSuperAdmin && selectedOrgId ? { _org_id: selectedOrgId } : {}),
      ]);
      return {
        boards: boards.count ?? 0,
        open: openTasks.count ?? 0,
        closed: closedTasks.count ?? 0,
        members: members.count ?? 0,
        overdue: Number(overdue.data ?? 0),
      };
    },
    enabled: !isSuperAdmin || !!selectedOrgId,
  });

  const stats: Stat[] = [
    { label: "Активные доски", value: String(counts?.boards ?? "—"), delta: "по организации", icon: KanbanSquare, tone: "brand" },
    { label: "Открытые задачи", value: String(counts?.open ?? "—"), delta: "в работе", icon: Clock, tone: "muted" },
    { label: "Закрыто за месяц", value: String(counts?.closed ?? "—"), delta: "за 30 дн.", icon: CheckCircle2, tone: "success" },
    { label: "Просроченные", value: String(counts?.overdue ?? "—"), delta: "без срока", icon: AlertTriangle, tone: "danger" },
    { label: "Участников", value: String(counts?.members ?? "—"), delta: "в организации", icon: Users, tone: "muted" },
  ];

  const greeting = profile?.full_name || user?.email?.split("@")[0] || "коллега";

  return (
    <AppShell>
      <OrgGuard>
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
          {canCreateBoard && (
            <Link
              to="/boards"
              className="ring-focus inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-glow"
            >
              <Plus className="h-4 w-4" />
              Создать доску
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Аналитика</h2>
          <div className="flex gap-1">
            {[
              { label: "7д", value: 7 },
              { label: "30д", value: 30 },
              { label: "90д", value: 90 },
              { label: "365д", value: 365 },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="surface-card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Создано / Закрыто</h2>
            </div>
            <CompletionChart period={period} />
          </section>

          <section className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">По приоритетам</h2>
            </div>
            <PriorityChart period={period} />
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Нагрузка по исполнителям</h2>
            </div>
            <WorkloadChart period={period} />
          </section>

          <TasksChart />
        </div>
      </div>
      </OrgGuard>
    </AppShell>
  );
}
