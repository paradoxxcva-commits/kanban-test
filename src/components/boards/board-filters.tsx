import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BoardFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  priority: string[];
  onPriorityChange: (v: string[]) => void;
  assignee: string[];
  onAssigneeChange: (v: string[]) => void;
  status: string;
  onStatusChange: (v: string) => void;
  members: { id: string; full_name: string | null; email: string }[];
  totalCount: number;
  filteredCount: number;
}

const PRIORITIES = [
  { label: "Низкий", value: "low" },
  { label: "Обычный", value: "normal" },
  { label: "Высокий", value: "high" },
  { label: "Срочно", value: "urgent" },
];

export function BoardFilters({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  assignee,
  onAssigneeChange,
  status,
  onStatusChange,
  members,
  totalCount,
  filteredCount,
}: BoardFiltersProps) {
  const hasFilters = search || priority.length > 0 || assignee.length > 0 || status !== "all";

  const togglePriority = (p: string) => {
    if (priority.includes(p)) {
      onPriorityChange(priority.filter((x) => x !== p));
    } else {
      onPriorityChange([...priority, p]);
    }
  };

  const toggleAssignee = (id: string) => {
    if (assignee.includes(id)) {
      onAssigneeChange(assignee.filter((x) => x !== id));
    } else {
      onAssigneeChange([...assignee, id]);
    }
  };

  const clearAll = () => {
    onSearchChange("");
    onPriorityChange([]);
    onAssigneeChange([]);
    onStatusChange("all");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по задачам..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={priority.length === 1 ? priority[0] : "__all"}
          onValueChange={(v) => onPriorityChange(v === "__all" ? [] : [v])}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Приоритет" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Все приоритеты</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={assignee.length === 1 ? assignee[0] : "__all"}
          onValueChange={(v) => onAssigneeChange(v === "__all" ? [] : [v])}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Исполнитель" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Все исполнители</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name || m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="open">Открытые</SelectItem>
            <SelectItem value="completed">Выполненные</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1 h-3 w-3" />
            Очистить
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredCount === totalCount
            ? `${totalCount} задач`
            : `${filteredCount} из ${totalCount} задач`}
        </span>
      </div>
    </div>
  );
}
