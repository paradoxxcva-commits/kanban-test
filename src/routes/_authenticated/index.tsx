import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanSquare, CheckCircle2, Clock, Users, TrendingUp, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
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

const stats: Stat[] = [
  { label: "Активные доски", value: "12", delta: "+2 за неделю", icon: KanbanSquare, tone: "brand" },
  { label: "Открытые задачи", value: "184", delta: "−9 за неделю", icon: Clock, tone: "muted" },
  { label: "Закрыто за месяц", value: "327", delta: "+18%", icon: CheckCircle2, tone: "success" },
  { label: "Участников", value: "24", delta: "+3 новых", icon: Users, tone: "muted" },
];

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

function BoardRow({
  name,
  project,
  progress,
  members,
}: {
  name: string;
  project: string;
  progress: number;
  members: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-transparent px-3 py-3 transition hover:border-border hover:bg-accent/40">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <KanbanSquare className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{project}</div>
      </div>
      <div className="hidden w-40 md:block">
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Прогресс</span>
          <span className="text-mono tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="text-mono hidden w-16 text-right text-xs text-muted-foreground tabular-nums md:block">
        {members} чел.
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Рабочее пространство
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Добро пожаловать, Александр
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Обзор активности за последние 7 дней по всем доскам организации.
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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Активные доски</h2>
                <p className="text-xs text-muted-foreground">Последние обновления</p>
              </div>
              <button className="text-xs font-medium text-brand hover:text-brand-glow">
                Все доски →
              </button>
            </div>
            <div className="space-y-1">
              <BoardRow name="Релиз 2.4 — мобильное приложение" project="Mobile Team" progress={72} members={6} />
              <BoardRow name="Дизайн-система v3" project="Design Ops" progress={45} members={4} />
              <BoardRow name="Миграция инфраструктуры" project="DevOps" progress={88} members={3} />
              <BoardRow name="Маркетинговая кампания Q3" project="Marketing" progress={20} members={5} />
              <BoardRow name="Онбординг новых сотрудников" project="HR" progress={60} members={2} />
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Лента активности</h2>
            </div>
            <ul className="space-y-4">
              {[
                { who: "Мария К.", what: "закрыла задачу", target: "#142 Аутентификация", when: "5 мин назад" },
                { who: "Игорь С.", what: "создал доску", target: "Релиз 2.4", when: "1 ч назад" },
                { who: "Анна В.", what: "обновила колонку", target: "В работе", when: "3 ч назад" },
                { who: "Дмитрий Л.", what: "пригласил", target: "petrov@example.com", when: "Вчера" },
              ].map((e, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                    {e.who
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground">
                      <span className="font-medium">{e.who}</span>{" "}
                      <span className="text-muted-foreground">{e.what}</span>{" "}
                      <span className="font-medium">{e.target}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{e.when}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
