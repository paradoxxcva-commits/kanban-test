import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type AnyClient = any;

export function WorkloadChart({ period }: { period: number }) {
  const { data = [] } = useQuery({
    queryKey: ["tasks-by-assignee", period],
    queryFn: async () => {
      const client = supabase as AnyClient;
      const { data, error } = await client.rpc("tasks_by_assignee", {
        _days: period,
      });
      if (error) throw error;
      return (data ?? []) as {
        assignee_id: string;
        assignee_name: string;
        total: number;
        completed: number;
      }[];
    },
  });

  const chartData = data.map((d) => ({
    name: d.assignee_name.length > 12
      ? d.assignee_name.slice(0, 12) + "…"
      : d.assignee_name,
    Всего: Number(d.total),
    Выполнено: Number(d.completed),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Нет данных
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Всего" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Выполнено" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
