import { useAuth } from "@/lib/auth-context";
import { Sparkles } from "lucide-react";

export function AdBanner() {
  const { profile } = useAuth();

  if (!profile?.show_ads) return null;

  return (
    <div className="border-t border-border bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/20">
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              Планируйте задачи эффективнее с Планка Плюс
            </div>
            <div className="text-xs text-muted-foreground">
              Расширенная аналитика, приоритетная поддержка, неограниченное хранилище
            </div>
          </div>
        </div>
        <a
          href="#"
          className="hidden shrink-0 rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-glow sm:block"
        >
          Подробнее
        </a>
      </div>
    </div>
  );
}
