import { Bell, Search, Sun, Moon, Sparkles } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

function TopbarPromo() {
  return (
    <div className="hidden items-center gap-3 rounded-md border border-border bg-surface px-3 py-1.5 lg:flex">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-brand/15 text-brand">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="text-xs">
        <div className="font-medium text-foreground">Расширьте лимиты</div>
        <div className="text-[11px] text-muted-foreground">До 50 досок и приоритетная поддержка</div>
      </div>
      <button
        type="button"
        className="ring-focus rounded bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground transition hover:bg-brand-glow"
      >
        Тариф
      </button>
    </div>
  );
}

export function Topbar() {
  const { theme, toggle } = useTheme();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
      {/* Поиск */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Поиск задач, досок и людей…"
          className="ring-focus w-full rounded-md border border-input bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <kbd className="text-mono pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1" />

      <TopbarPromo />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
        className="ring-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <button
        type="button"
        aria-label="Уведомления"
        className="ring-focus relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
      </button>

      <div className="flex items-center gap-2 rounded-md border border-border bg-surface py-1 pl-1 pr-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-foreground">
          АП
        </div>
        <div className="hidden text-left leading-tight md:block">
          <div className="text-xs font-medium text-foreground">Александр П.</div>
          <div className="text-[10px] text-muted-foreground">Администратор</div>
        </div>
      </div>
    </header>
  );
}
