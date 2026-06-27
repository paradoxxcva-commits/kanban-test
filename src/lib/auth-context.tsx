import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "user";

export interface Profile {
  id: string;
  org_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  paid_until: string | null;
  is_active: boolean;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  isSuspended: boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const client = supabase as any;
    const [{ data: p }, { data: r }] = await Promise.all([
      client.from("profiles").select("*").eq("id", uid).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles(((r as { role: AppRole }[]) ?? []).map((x) => x.role));
  }, []);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.data.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const isSuspended = useMemo(() => {
    if (!profile) return false;
    if (!profile.is_active) return true;
    if (profile.paid_until && new Date(profile.paid_until) < new Date()) return true;
    return false;
  }, [profile]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    signIn,
    signOut,
    refresh,
    hasRole: (r) => roles.includes(r),
    isSuspended,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
