import { Button } from "@/components/ui/button";

const PERIODS = [
  { label: "7д", value: 7 },
  { label: "30д", value: 30 },
  { label: "90д", value: 90 },
  { label: "365д", value: 365 },
];

export function PeriodSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
