import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, KanbanSquare, MoreHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CreateBoardDialog } from "@/components/boards/create-board-dialog";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { OrgGuard } from "@/components/layout/org-selector";
import type { BoardRow } from "@/lib/boards-api";

export const Route = createFileRoute("/_authenticated/boards/")({
  head: () => ({
    meta: [
      { title: "Доски — Планка" },
      { name: "description", content: "Список канбан-досок организации." },
    ],
  }),
  component: BoardsPage,
});

const COLOR_MAP: Record<string, string> = {
  brand: "from-brand/30 to-brand/5 border-brand/30",
  sky: "from-sky-500/30 to-sky-500/5 border-sky-500/30",
  emerald: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/30",
  violet: "from-violet-500/30 to-violet-500/5 border-violet-500/30",
  rose: "from-rose-500/30 to-rose-500/5 border-rose-500/30",
  amber: "from-amber-500/30 to-amber-500/5 border-amber-500/30",
};

function BoardsPage() {
  const [open, setOpen] = useState(false);
  const { hasRole } = useAuth();
  const { selectedOrgId, isSuperAdmin } = useOrg();
  const canCreateBoard = hasRole("admin") || hasRole("super_admin");
  const { data: boards, isLoading } = useQuery({
    queryKey: ["boards", selectedOrgId],
    queryFn: async (): Promise<BoardRow[]> => {
      let query = supabase.from("boards").select("*");
      if (isSuperAdmin && selectedOrgId) {
        query = query.eq("org_id", selectedOrgId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
    enabled: !isSuperAdmin || !!selectedOrgId,
  });

  return (
    <AppShell>
      <OrgGuard>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Планка
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Доски
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Все доски вашей организации.
            </p>
          </div>
          {canCreateBoard && (
            <Button onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Создать доску
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : boards && boards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boards.map((b) => (
              <Link
                key={b.id}
                to="/boards/$boardId"
                params={{ boardId: b.id }}
                className={`surface-card group relative overflow-hidden p-5 transition hover:border-border/80 hover:shadow-card`}
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                    COLOR_MAP[b.color ?? "brand"] ?? COLOR_MAP.brand
                  }`}
                />
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-muted-foreground">
                    <KanbanSquare className="h-4 w-4" />
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
                <div className="mt-4 text-base font-semibold text-foreground">{b.name}</div>
                {b.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {b.description}
                  </p>
                )}
                <div className="mt-4 text-[11px] text-muted-foreground">
                  создана {new Date(b.created_at).toLocaleDateString("ru-RU")}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="surface-card flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <KanbanSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-base font-semibold text-foreground">Пока нет досок</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Создайте первую канбан-доску, чтобы организовать задачи команды.
            </p>
            {canCreateBoard && (
              <Button onClick={() => setOpen(true)} className="mt-2 gap-1.5">
                <Plus className="h-4 w-4" />
                Создать доску
              </Button>
            )}
          </div>
        )}
      </div>
      <CreateBoardDialog open={open} onOpenChange={setOpen} />
      </OrgGuard>
    </AppShell>
  );
}
