"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WaveformIcon, UsersIcon } from "@/components/icons";

export default function InvitePage() {
  const params = useParams();
  const code = params.code as string;
  const router = useRouter();
  const supabase = createClient();

  const [vaultName, setVaultName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkInvite = async () => {
      // Try to find vault by invite code
      const { data: vault } = await supabase
        .from("vaults")
        .select("id, name, invite_code")
        .eq("invite_code", code)
        .single();

      if (!vault) {
        setError("This invite link is invalid or has expired.");
        setLoading(false);
        return;
      }

      setVaultName(vault.name);
      setLoading(false);

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // They'll need to log in first

      // Check if already a member
      const { data: existing } = await supabase
        .from("vault_members")
        .select("*")
        .eq("vault_id", vault.id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        router.push(`/vault/${vault.id}`);
      }
    };
    checkInvite();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    setJoining(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login, then back here
      router.push(`/login?redirect=/invite/${code}`);
      return;
    }

    try {
      const { data: vault } = await supabase
        .from("vaults")
        .select("id")
        .eq("invite_code", code)
        .single();

      if (!vault) throw new Error("Vault not found");

      const { error: joinErr } = await supabase
        .from("vault_members")
        .insert({ vault_id: vault.id, user_id: user.id, role: "member" });

      if (joinErr) {
        if (joinErr.code === "23505") {
          // Already a member
          router.push(`/vault/${vault.id}`);
          return;
        }
        throw joinErr;
      }

      router.push(`/vault/${vault.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join vault");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface-dim">
        <div className="animate-pulse text-sm text-on-surface-variant">Loading invite...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-surface-dim">
      <div className="w-full max-w-md">
        <div className="surface-card-elevated p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/15 flex items-center justify-center">
            <UsersIcon size={28} className="text-primary" />
          </div>

          {error ? (
            <>
              <h1 className="text-lg font-semibold text-on-surface mb-2">
                Invalid invite
              </h1>
              <p className="text-sm text-on-surface-variant mb-6">{error}</p>
              <button onClick={() => router.push("/")} className="btn-primary">
                Go home
              </button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-on-surface mb-2">
                You&apos;re invited!
              </h1>
              <p className="text-sm text-on-surface-variant mb-6">
                Join <strong className="text-on-surface">{vaultName}</strong> to listen to and share family stories.
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="btn-primary w-full disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join vault"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <WaveformIcon size={14} className="text-on-surface-variant/40" />
          <span className="text-xs text-on-surface-variant/40">Echo Legacy</span>
        </div>
      </div>
    </div>
  );
}
