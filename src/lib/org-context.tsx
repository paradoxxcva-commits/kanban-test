import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";

interface OrgContextValue {
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  isSuperAdmin: boolean;
}

const OrgContext = createContext<OrgContextValue>({
  selectedOrgId: null,
  setSelectedOrgId: () => {},
  isSuperAdmin: false,
});

const STORAGE_KEY = "super_admin_org_id";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { profile, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");

  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (!isSuperAdmin) return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedOrgIdState(profile?.org_id ?? null);
    }
  }, [isSuperAdmin, profile?.org_id]);

  const setSelectedOrgId = (id: string | null) => {
    setSelectedOrgIdState(id);
    if (isSuperAdmin) {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  return (
    <OrgContext.Provider
      value={{
        selectedOrgId: isSuperAdmin ? selectedOrgId : (profile?.org_id ?? null),
        setSelectedOrgId,
        isSuperAdmin,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
