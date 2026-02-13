"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User, VaultWithRole } from "@/types/database";

interface AuthContextType {
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  vaults: VaultWithRole[];
  currentVault: VaultWithRole | null;
  currentRole: string | null;
  loading: boolean;
  setCurrentVault: (vault: VaultWithRole) => void;
  refreshProfile: () => Promise<void>;
  refreshVaults: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  supabaseUser: null,
  profile: null,
  vaults: [],
  currentVault: null,
  currentRole: null,
  loading: true,
  setCurrentVault: () => {},
  refreshProfile: async () => {},
  refreshVaults: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [vaults, setVaults] = useState<VaultWithRole[]>([]);
  const [currentVault, setCurrentVaultState] = useState<VaultWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data as User);
  }, [supabase]);

  const refreshVaults = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: members } = await supabase
      .from("vault_members")
      .select("vault_id, role")
      .eq("user_id", user.id);

    if (!members || members.length === 0) {
      setVaults([]);
      return;
    }

    const vaultIds = members.map((m) => m.vault_id);
    const { data: vaultData } = await supabase
      .from("vaults")
      .select("*")
      .in("id", vaultIds);

    if (vaultData) {
      const vaultsWithRoles: VaultWithRole[] = vaultData.map((v) => ({
        ...v,
        role: members.find((m) => m.vault_id === v.id)?.role || "viewer",
      })) as VaultWithRole[];
      setVaults(vaultsWithRoles);

      // Restore current vault from localStorage or use first
      const savedVaultId = localStorage.getItem("echo_current_vault");
      const saved = vaultsWithRoles.find((v) => v.id === savedVaultId);
      if (saved) {
        setCurrentVaultState(saved);
      } else if (vaultsWithRoles.length > 0 && !currentVault) {
        setCurrentVaultState(vaultsWithRoles[0]);
      }
    }
  }, [supabase, currentVault]);

  const setCurrentVault = useCallback((vault: VaultWithRole) => {
    setCurrentVaultState(vault);
    localStorage.setItem("echo_current_vault", vault.id);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSupabaseUser(null);
    setProfile(null);
    setVaults([]);
    setCurrentVaultState(null);
    localStorage.removeItem("echo_current_vault");
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUser(user);
      if (user) {
        await refreshProfile();
        await refreshVaults();
      }
      setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          await refreshProfile();
          await refreshVaults();
        } else {
          setProfile(null);
          setVaults([]);
          setCurrentVaultState(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        profile,
        vaults,
        currentVault,
        currentRole: currentVault?.role ?? null,
        loading,
        setCurrentVault,
        refreshProfile,
        refreshVaults,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
