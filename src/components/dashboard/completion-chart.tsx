import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type AnyClient = any;

export function CompletionChart({ period }: { period: number }) {
  const { data = [] } = useQuery({
    queryKey: ["completion-rate", period],
    queryFn: async () => {
      const client = supabase as AnyClient;
      const { data, error } = await client.rpc("completion_rate_over_time", {
        _days: period,
      });
      if (error) throw error;
      return (data ?? []) as {
        bucket: string;
        opened: number;
        closed: number;
      }[];
    },
  });

  const chartData = data.map((d) => ({
    date: new Date(d.bucket).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }),
    Создано: Number(d.opened),
    Закрыто: Number(d.closed),
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
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Area type="monotone" dataKey="Создано" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
        <Area type="monotone" dataKey="Закрыто" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
