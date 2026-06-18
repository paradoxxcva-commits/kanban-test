import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";

type Period = 7 | 30 | 90;

interface Bucket {
  bucket: string;
  count: number;
}

export function TasksChart() {
  const [period, setPeriod] = useState<Period>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks-completed", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tasks_completed_by_period", { _days: period });
      if (error) throw error;
      return (data as Bucket[]) ?? [];
    },
  });

  const grouped = groupByWeek(data ?? []);
  const total = (data ?? []).reduce((s, d) => s + Number(d.count), 0);

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Выполненные задачи</h2>
            <p className="text-xs text-muted-foreground">
              Всего за период: <span className="text-foreground tabular-nums">{total}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                period === p
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p} дн.
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Загрузка…
          </div>
        ) : grouped.length === 0 || total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            <span>Пока нет закрытых задач за выбранный период.</span>
            <span className="text-[11px]">Завершайте задачи на досках — здесь появится статистика.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grouped} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [`${v} зад.`, "Закрыто"]}
              />
              <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function groupByWeek(rows: Bucket[]): { label: string; count: number }[] {
  if (rows.length === 0) return [];
  const weeks = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.bucket);
    const wkStart = new Date(d);
    const day = (wkStart.getDay() + 6) % 7; // monday start
    wkStart.setDate(wkStart.getDate() - day);
    const key = wkStart.toISOString().slice(0, 10);
    weeks.set(key, (weeks.get(key) ?? 0) + Number(r.count));
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, count]) => {
      const d = new Date(k);
      const label = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
      return { label, count };
    });
}
