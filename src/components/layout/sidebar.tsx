import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  CalendarDays,
  Users,
  Settings,
  Shield,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
}

const mainNav: NavItem[] = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/boards", label: "Доски", icon: KanbanSquare, badge: "12" },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/team", label: "Команда", icon: Users },
];

const adminNav: NavItem[] = [
  { to: "/settings", label: "Настройки", icon: Settings },
  { to: "/super-admin", label: "Системный админ", icon: Shield },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="text-mono rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] tabular-nums text-sidebar-muted">
          {item.badge}
        </span>
      )}
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-brand" aria-hidden />
      )}
    </Link>
  );
}

function SidebarSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70">
        {title}
      </div>
      {items.map((item) => (
        <NavLink key={item.to} item={item} />
      ))}
    </div>
  );
}

function PromoBlock() {
  return (
    <div className="surface-card border-sidebar-border bg-sidebar-accent/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/15 text-brand">
          <Zap className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold text-sidebar-foreground">Быстрый старт</div>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-sidebar-muted">
        Подключите Telegram-бота и получайте уведомления о задачах прямо в чате.
      </p>
      <button
        type="button"
        className="ring-focus inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-glow"
      >
        Подключить
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Лого */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <KanbanSquare className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Канбан</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-muted">workspace</span>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <SidebarSection title="Рабочее пространство" items={mainNav} />
        <SidebarSection title="Управление" items={adminNav} />
      </nav>

      {/* Промо */}
      <div className="border-t border-sidebar-border p-3">
        <PromoBlock />
      </div>
    </aside>
  );
}
