import { Search, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCenter } from "./notification-center";
import { OrgSelector } from "./org-selector";

function initials(name: string | null | undefined, email: string | undefined) {
  const src = (name && name.trim()) || email || "?";
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Topbar() {
  const { theme, toggle } = useTheme();
  const { profile, user, roles, signOut } = useAuth();
  const { selectedOrgId, isSuperAdmin } = useOrg();

  const { data: org } = useQuery({
    queryKey: ["org", isSuperAdmin ? selectedOrgId : profile?.org_id],
    queryFn: async () => {
      const orgId = isSuperAdmin ? selectedOrgId : profile?.org_id;
      if (!orgId) return null;
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single();
      return data;
    },
    enabled: !!(isSuperAdmin ? selectedOrgId : profile?.org_id),
  });

  const roleLabel = roles.includes("super_admin")
    ? "Системный администратор"
    : roles.includes("admin")
      ? "Администратор организации"
      : "Сотрудник";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
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

      {isSuperAdmin && <OrgSelector />}

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
        className="ring-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="hidden rounded-lg bg-gradient-to-br from-brand/20 to-brand/5 px-3 py-1.5 text-center md:block">
        <div className="text-[10px] font-medium text-foreground">Планируйте задачи эффективнее</div>
        <div className="text-[9px] text-muted-foreground">Попробуйте Планка Плюс</div>
      </div>

      <NotificationCenter />

      <div className="flex items-center gap-2 rounded-md border border-border bg-surface py-1 pl-1 pr-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-foreground">
          {initials(profile?.full_name, user?.email)}
        </div>
        <div className="hidden text-left leading-tight md:block">
          <div className="max-w-[180px] truncate text-xs font-medium text-foreground">
            {profile?.full_name || user?.email || "Гость"}
          </div>
          {isSuperAdmin ? (
            <div className="text-[10px] font-semibold text-amber-500">
              {roleLabel}
            </div>
          ) : roles.includes("admin") ? (
            <div className="text-[10px] font-semibold text-blue-500">
              {roleLabel}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">
              {org?.name || roleLabel}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={signOut}
        aria-label="Выйти"
        title="Выйти"
        className="ring-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
