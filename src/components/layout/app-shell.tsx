import type { ReactNode } from "react";
import { AppSidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AdBanner } from "./ad-banner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        <AdBanner />
      </div>
    </div>
  );
}
