import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Users, Shield, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Команда — Планка" }] }),
  component: MembersPage,
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Системный администратор",
  admin: "Администратор",
  user: "Сотрудник",
};

const ROLE_ICON: Record<string, typeof Shield> = {
  super_admin: Shield,
  admin: Shield,
  user: User,
};

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  admin: "bg-brand/15 text-brand",
  user: "bg-accent text-muted-foreground",
};

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  roles: string[];
}

function initials(name: string | null, email: string) {
  const src = (name && name.trim()) || email;
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function MembersPage() {
  const { profile } = useAuth();

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", profile?.org_id],
    queryFn: async (): Promise<Member[]> => {
      if (!profile?.org_id) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, is_active, created_at")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });
      if (pErr) throw pErr;

      const userIds = (profiles ?? []).map((p) => p.id);
      if (userIds.length === 0) return [];

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesByUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role);
        rolesByUser.set(r.user_id, list);
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
    enabled: !!profile?.org_id,
  });

  if (!profile?.org_id) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            Вы не привязаны к организации.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Команда
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Участники организации
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Все участники вашей организации и их роли.
          </p>
        </header>

        <div className="surface-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-border">
              {members.map((m) => {
                const primaryRole = m.roles[0] ?? "user";
                const RoleIcon = ROLE_ICON[primaryRole] ?? User;
                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {initials(m.full_name, m.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {m.full_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.roles.map((r) => {
                        const Icon = ROLE_ICON[r] ?? User;
                        return (
                          <span
                            key={r}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${ROLE_STYLE[r] ?? ROLE_STYLE.user}`}
                          >
                            <Icon className="h-3 w-3" />
                            {ROLE_LABEL[r] ?? r}
                          </span>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.is_active ? (
                        <span className="text-success">активен</span>
                      ) : (
                        <span className="text-destructive">выключен</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              В организации пока нет участников.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
