"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthProvider } from "@/lib/auth-context";
import { HomeIcon, MicIcon, SearchIcon, SettingsIcon, WaveformIcon } from "@/components/icons";
import type { VaultWithRole } from "@/types/database";

function BottomNav({ vaultId, role }: { vaultId: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { id: "home", icon: HomeIcon, label: "Home", href: `/vault/${vaultId}` },
    ...(role !== "viewer"
      ? [{ id: "record", icon: MicIcon, label: "Record", href: `/vault/${vaultId}/record` }]
      : []),
    { id: "search", icon: SearchIcon, label: "Search", href: `/vault/${vaultId}/search` },
    { id: "settings", icon: SettingsIcon, label: "Settings", href: `/vault/${vaultId}/settings` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-container border-t border-outline-variant/30 z-50 safe-area-inset-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = tab.id === "home"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`touch-target flex flex-col items-center gap-0.5 px-3 transition-colors ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <div className={`p-1 rounded-full transition-colors ${isActive ? "bg-primary/15" : ""}`}>
                <Icon size={22} />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const router = useRouter();
  const [vault, setVault] = useState<VaultWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadVault = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: member } = await supabase
        .from("vault_members")
        .select("role")
        .eq("vault_id", vaultId)
        .eq("user_id", user.id)
        .single();

      if (!member) {
        router.push("/vault");
        return;
      }

      const { data: vaultData } = await supabase
        .from("vaults")
        .select("*")
        .eq("id", vaultId)
        .single();

      if (vaultData) {
        setVault({ ...vaultData, role: member.role } as VaultWithRole);
      }
      setLoading(false);
    };
    loadVault();
  }, [vaultId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface-dim">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <WaveformIcon size={32} className="text-primary" />
          <p className="text-sm text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!vault) return null;

  return (
    <AuthProvider>
      <div className="min-h-dvh bg-surface-dim pb-20">
        {children}
        <BottomNav vaultId={vaultId} role={vault.role} />
      </div>
    </AuthProvider>
  );
}
