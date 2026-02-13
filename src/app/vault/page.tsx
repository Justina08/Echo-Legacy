"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { VaultWithRole } from "@/types/database";
import { WaveformIcon, PlusIcon } from "@/components/icons";

export default function VaultListPage() {
  const [vaults, setVaults] = useState<VaultWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadVaults = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: members } = await supabase
        .from("vault_members")
        .select("vault_id, role")
        .eq("user_id", user.id);

      if (!members || members.length === 0) {
        router.push("/onboarding");
        return;
      }

      const vaultIds = members.map((m) => m.vault_id);
      const { data: vaultData } = await supabase
        .from("vaults")
        .select("*")
        .in("id", vaultIds);

      if (vaultData) {
        const withRoles: VaultWithRole[] = vaultData.map((v) => ({
          ...v,
          role: members.find((m) => m.vault_id === v.id)?.role || "viewer",
        })) as VaultWithRole[];
        setVaults(withRoles);

        // If single vault, redirect directly
        if (withRoles.length === 1) {
          router.push(`/vault/${withRoles[0].id}`);
          return;
        }
      }
      setLoading(false);
    };
    loadVaults();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface-dim">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <WaveformIcon size={32} className="text-primary" />
          <p className="text-sm text-on-surface-variant">Loading your vaults...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-dim p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <WaveformIcon size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-on-surface">Your vaults</h1>
            <p className="text-xs text-on-surface-variant">Choose a vault to open</p>
          </div>
        </div>

        <div className="space-y-3">
          {vaults.map((vault) => (
            <button
              key={vault.id}
              onClick={() => router.push(`/vault/${vault.id}`)}
              className="w-full p-4 surface-card hover:bg-surface-container-high transition-colors rounded-xl flex items-center justify-between"
            >
              <div className="text-left">
                <p className="font-medium text-on-surface">{vault.name}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 capitalize">
                  {vault.role} {vault.is_pro && " · Pro"}
                </p>
              </div>
              <div className="text-on-surface-variant">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>
          ))}

          <button
            onClick={() => router.push("/onboarding")}
            className="w-full p-4 border border-dashed border-outline-variant rounded-xl flex items-center gap-3 text-on-surface-variant hover:text-on-surface hover:border-outline transition-colors"
          >
            <PlusIcon size={20} />
            <span className="text-sm font-medium">Create or join another vault</span>
          </button>
        </div>
      </div>
    </div>
  );
}
