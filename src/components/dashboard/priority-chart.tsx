import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

type AnyClient = any;

const COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#6b7280",
};

const LABELS: Record<string, string> = {
  urgent: "Срочно",
  high: "Высокий",
  normal: "Обычный",
  low: "Низкий",
};

export function PriorityChart({ period }: { period: number }) {
  const { data = [] } = useQuery({
    queryKey: ["tasks-by-priority", period],
    queryFn: async () => {
      const client = supabase as AnyClient;
      const { data, error } = await client.rpc("tasks_by_priority", {
        _days: period,
      });
      if (error) throw error;
      return (data ?? []) as { priority: string; count: number }[];
    },
  });

  const chartData = data.map((d) => ({
    name: LABELS[d.priority] ?? d.priority,
    value: Number(d.count),
    color: COLORS[d.priority] ?? "#6b7280",
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
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
