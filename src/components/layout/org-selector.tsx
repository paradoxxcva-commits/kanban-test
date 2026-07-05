import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface Org {
  id: string;
  name: string;
}

export function OrgSelector() {
  const { selectedOrgId, setSelectedOrgId, isSuperAdmin } = useOrg();

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Org[]> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Org[];
    },
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  return (
    <Select
      value={selectedOrgId ?? ""}
      onValueChange={(v) => setSelectedOrgId(v || null)}
    >
      <SelectTrigger className="h-8 w-[200px] gap-1.5 text-xs">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Выберите организацию" />
      </SelectTrigger>
      <SelectContent>
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.id} className="text-xs">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const { selectedOrgId, isSuperAdmin } = useOrg();

  if (isSuperAdmin && !selectedOrgId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground/50" />
        <div className="text-sm text-muted-foreground">
          Выберите организацию в верхней панели
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
