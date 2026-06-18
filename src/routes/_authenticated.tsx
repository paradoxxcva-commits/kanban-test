import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { KanbanSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, session, isSuspended } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <KanbanSquare className="h-5 w-5 animate-pulse text-brand" />
          <span className="text-sm">Загрузка…</span>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (isSuspended) return <Navigate to="/suspended" replace />;
  return <Outlet />;
}
