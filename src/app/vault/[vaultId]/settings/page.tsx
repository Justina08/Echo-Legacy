"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Vault, VaultMember, VaultRole, User, PromptCadence } from "@/types/database";
import {
  ChevronLeftIcon, CopyIcon, UsersIcon, LogOutIcon, ShareIcon, SparklesIcon
} from "@/components/icons";

export default function SettingsPage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const router = useRouter();
  const supabase = createClient();

  const [vault, setVault] = useState<Vault | null>(null);
  const [members, setMembers] = useState<(VaultMember & { name?: string; email?: string })[]>([]);
  const [profile, setProfile] = useState<User | null>(null);
  const [role, setRole] = useState<string>("viewer");
  const [vaultName, setVaultName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [promptCadence, setPromptCadence] = useState<PromptCadence>("off");
  const [promptTime, setPromptTime] = useState("09:00");

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [vaultRes, memberRes, profileRes] = await Promise.all([
      supabase.from("vaults").select("*").eq("id", vaultId).single(),
      supabase.from("vault_members").select("*").eq("vault_id", vaultId),
      supabase.from("users").select("*").eq("id", user.id).single(),
    ]);

    if (vaultRes.data) {
      setVault(vaultRes.data as Vault);
      setVaultName(vaultRes.data.name);
    }

    if (profileRes.data) {
      setProfile(profileRes.data as User);
      setPromptCadence((profileRes.data as User).prompt_cadence);
      setPromptTime((profileRes.data as User).prompt_time);
    }

    const currentMember = memberRes.data?.find((m) => m.user_id === user.id);
    if (currentMember) setRole(currentMember.role);

    if (memberRes.data) {
      // Fetch user names for members
      const userIds = memberRes.data.map((m) => m.user_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", userIds);

      const enriched = memberRes.data.map((m) => {
        const u = users?.find((usr) => usr.id === m.user_id);
        return { ...m, name: u?.name, email: u?.email };
      });
      setMembers(enriched as (VaultMember & { name?: string; email?: string })[]);
    }

    setLoading(false);
  }, [vaultId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isOwner = role === "owner";

  const saveVaultName = async () => {
    if (!vault || !vaultName.trim()) return;
    await supabase.from("vaults").update({ name: vaultName.trim() }).eq("id", vault.id);
    setVault({ ...vault, name: vaultName.trim() });
    setEditingName(false);
  };

  const copyInviteCode = () => {
    if (!vault) return;
    navigator.clipboard.writeText(vault.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!vault) return;
    const url = `${window.location.origin}/invite/${vault.invite_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updatePromptCadence = async (cadence: PromptCadence) => {
    setPromptCadence(cadence);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({ prompt_cadence: cadence }).eq("id", user.id);
    }
  };

  const updatePromptTime = async (time: string) => {
    setPromptTime(time);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("users").update({ prompt_time: time }).eq("id", user.id);
    }
  };

  const removeMember = async (userId: string) => {
    await supabase.from("vault_members").delete().eq("vault_id", vaultId).eq("user_id", userId);
    setMembers(members.filter((m) => m.user_id !== userId));
  };

  const changeRole = async (userId: string, newRole: string) => {
    await supabase.from("vault_members").update({ role: newRole }).eq("vault_id", vaultId).eq("user_id", userId);
    setMembers(members.map((m) => m.user_id === userId ? { ...m, role: newRole as VaultRole } : m));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleUpgrade = async () => {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert("Failed to start checkout. Please try again.");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to open billing portal.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-pulse text-sm text-on-surface-variant">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-semibold text-on-surface mb-6">Settings</h1>

      {/* Vault Name */}
      <section className="surface-card p-4 mb-4">
        <h2 className="text-xs font-medium text-on-surface-variant mb-3">Vault</h2>
        {editingName && isOwner ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              className="input-field flex-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveVaultName()}
            />
            <button onClick={saveVaultName} className="btn-tonal text-xs px-3">Save</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface">{vault?.name}</p>
              <p className="text-xs text-on-surface-variant capitalize">{role}</p>
            </div>
            {isOwner && (
              <button onClick={() => setEditingName(true)} className="btn-text text-xs">
                Edit
              </button>
            )}
          </div>
        )}

        {/* Pro Status */}
        <div className="mt-3 pt-3 border-t border-outline-variant/30">
          {vault?.is_pro ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparklesIcon size={16} className="text-primary" />
                <span className="text-sm text-on-surface">Pro Plan</span>
              </div>
              {isOwner && (
                <button onClick={handleManageSubscription} className="btn-text text-xs">
                  Manage subscription
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Free Plan (3 recordings)</span>
              {isOwner && (
                <button onClick={handleUpgrade} className="btn-primary text-xs px-3 py-1.5">
                  Upgrade to Pro
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Invite */}
      {(isOwner || role === "member") && (
        <section className="surface-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShareIcon size={14} className="text-on-surface-variant" />
            <h2 className="text-xs font-medium text-on-surface-variant">Invite Family</h2>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 bg-surface-container-highest p-2.5 rounded-xl text-sm font-mono text-on-surface">
              {vault?.invite_code}
            </code>
            <button onClick={copyInviteCode} className="touch-target text-on-surface-variant hover:text-primary transition-colors">
              <CopyIcon size={18} />
            </button>
          </div>
          <button onClick={copyInviteLink} className="btn-text text-xs w-full">
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </section>
      )}

      {/* Members */}
      <section className="surface-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <UsersIcon size={14} className="text-on-surface-variant" />
          <h2 className="text-xs font-medium text-on-surface-variant">
            Members ({members.length})
          </h2>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-on-surface">{member.name || member.email || "Unknown"}</p>
                <p className="text-xs text-on-surface-variant capitalize">{member.role}</p>
              </div>
              {isOwner && member.role !== "owner" && (
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member.user_id, e.target.value)}
                    className="bg-surface-container-high text-xs text-on-surface rounded-lg px-2 py-1 border border-outline-variant"
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => removeMember(member.user_id)}
                    className="text-error text-xs hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Prompt Settings */}
      <section className="surface-card p-4 mb-4">
        <h2 className="text-xs font-medium text-on-surface-variant mb-3">Daily Prompts</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Cadence</label>
            <div className="flex flex-wrap gap-2">
              {(["off", "daily", "every_3_days", "weekly"] as PromptCadence[]).map((c) => (
                <button
                  key={c}
                  onClick={() => updatePromptCadence(c)}
                  className={promptCadence === c ? "chip-selected" : "chip cursor-pointer"}
                >
                  {c === "off" ? "Off" : c === "daily" ? "Daily" : c === "every_3_days" ? "Every 3 days" : "Weekly"}
                </button>
              ))}
            </div>
          </div>
          {promptCadence !== "off" && (
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Preferred time</label>
              <input
                type="time"
                value={promptTime}
                onChange={(e) => updatePromptTime(e.target.value)}
                className="input-field w-auto"
              />
            </div>
          )}
        </div>
      </section>

      {/* Profile */}
      <section className="surface-card p-4 mb-4">
        <h2 className="text-xs font-medium text-on-surface-variant mb-3">Account</h2>
        <p className="text-sm text-on-surface">{profile?.name}</p>
        <p className="text-xs text-on-surface-variant">{profile?.email}</p>
      </section>

      {/* Sign Out */}
      <button onClick={signOut} className="w-full flex items-center justify-center gap-2 p-3 text-error text-sm hover:bg-error-container/10 rounded-xl transition-colors">
        <LogOutIcon size={16} />
        Sign out
      </button>
    </div>
  );
}
