"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { WaveformIcon, PlusIcon, UsersIcon } from "@/components/icons";

type Step = "choose" | "create" | "join";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("choose");
  const [vaultName, setVaultName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const createVault = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: vault, error: vaultErr } = await supabase
        .from("vaults")
        .insert({ name: vaultName || "My Family Vault", owner_user_id: user.id })
        .select()
        .single();

      if (vaultErr) throw vaultErr;

      const { error: memberErr } = await supabase
        .from("vault_members")
        .insert({ vault_id: vault.id, user_id: user.id, role: "owner" });

      if (memberErr) throw memberErr;

      router.push(`/vault/${vault.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  const joinVault = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: vault, error: findErr } = await supabase
        .from("vaults")
        .select("*")
        .eq("invite_code", inviteCode.trim())
        .single();

      if (findErr || !vault) throw new Error("Invalid invite code");

      // Check if already a member
      const { data: existing } = await supabase
        .from("vault_members")
        .select("*")
        .eq("vault_id", vault.id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        router.push(`/vault/${vault.id}`);
        return;
      }

      const { error: joinErr } = await supabase
        .from("vault_members")
        .insert({ vault_id: vault.id, user_id: user.id, role: "member" });

      if (joinErr) throw joinErr;

      router.push(`/vault/${vault.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join vault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-surface-dim">
      <div className="w-full max-w-md">
        <div className="surface-card-elevated p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <WaveformIcon size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-on-surface">
                {step === "choose" && "Set up your vault"}
                {step === "create" && "Create a vault"}
                {step === "join" && "Join a vault"}
              </h1>
              <p className="text-xs text-on-surface-variant">
                {step === "choose" && "A vault is where your family stories live"}
                {step === "create" && "Start a new space for your family"}
                {step === "join" && "Enter the code shared by a family member"}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-container/30 text-error text-sm">
              {error}
            </div>
          )}

          {step === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => setStep("create")}
                className="w-full p-4 surface-card hover:bg-surface-container-high transition-colors rounded-xl flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PlusIcon size={24} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-on-surface">Create a vault</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Start recording and invite family later
                  </p>
                </div>
              </button>

              <button
                onClick={() => setStep("join")}
                className="w-full p-4 surface-card hover:bg-surface-container-high transition-colors rounded-xl flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary-container/30 flex items-center justify-center">
                  <UsersIcon size={24} className="text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-on-surface">Join a vault</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Use an invite code from a family member
                  </p>
                </div>
              </button>
            </div>
          )}

          {step === "create" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">
                  Vault name
                </label>
                <input
                  type="text"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  placeholder="e.g. The Johnson Family"
                  className="input-field"
                  autoFocus
                />
              </div>
              <button
                onClick={createVault}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create vault"}
              </button>
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="btn-text w-full text-xs"
              >
                Back
              </button>
            </div>
          )}

          {step === "join" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">
                  Invite code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="input-field text-center tracking-wider font-mono"
                  autoFocus
                />
              </div>
              <button
                onClick={joinVault}
                disabled={!inviteCode.trim() || loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join vault"}
              </button>
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="btn-text w-full text-xs"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
