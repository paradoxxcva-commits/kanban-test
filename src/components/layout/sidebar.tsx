import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  KanbanSquare,
  CalendarDays,
  Users,
  Settings,
  Shield,
  MessageSquare,
  UserCircle,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
}

const baseNav: NavItem[] = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/boards", label: "Доски", icon: KanbanSquare },
  { to: "/calendar", label: "Календарь", icon: CalendarDays },
  { to: "/chat", label: "Чат", icon: MessageSquare },
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

export function AppSidebar() {
  const { hasRole, profile } = useAuth();

  const mainNav: NavItem[] = [...baseNav];
  if (hasRole("super_admin")) {
    mainNav.push({ to: "/team", label: "Команда", icon: Users });
  }

  const adminNav: NavItem[] = [
    { to: "/account", label: "Аккаунт", icon: UserCircle },
    { to: "/settings", label: "Настройки", icon: Settings },
  ];
  if (hasRole("super_admin")) {
    adminNav.push({ to: "/super-admin", label: "Системный админ", icon: Shield });
  }

  const paid = profile?.paid_until ? new Date(profile.paid_until) : null;
  const daysLeft = paid ? Math.ceil((paid.getTime() - Date.now()) / 86400000) : null;

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <KanbanSquare className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Канбан</span>
          <span className="text-[10px] uppercase tracking-wider text-sidebar-muted">workspace</span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <SidebarSection title="Рабочее пространство" items={mainNav} />
        <SidebarSection title="Управление" items={adminNav} />
      </nav>

      {paid && daysLeft !== null && (
        <div className="border-t border-sidebar-border p-3">
          <div className="surface-card border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-sidebar-muted">
              Подписка
            </div>
            <div className="mt-1 text-sm font-semibold text-sidebar-foreground">
              {daysLeft > 0 ? `${daysLeft} дн.` : "истекла"}
            </div>
            <div className="text-[11px] text-sidebar-muted">
              до {paid.toLocaleDateString("ru-RU")}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
