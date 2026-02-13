"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recording, Vault } from "@/types/database";
import { WaveformIcon, ClockIcon, MicIcon } from "@/components/icons";
import { formatDistanceToNow } from "date-fns";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processing: "bg-primary/20 text-primary",
    ready: "bg-success/20 text-success",
    failed: "bg-error/20 text-error",
    uploading: "bg-primary/20 text-primary",
    rejected_paywall: "bg-error/20 text-error",
  };
  return (
    <span className={`status-pill ${styles[status] || ""}`}>
      {status === "rejected_paywall" ? "paywall" : status}
    </span>
  );
}

function RecordingCard({ recording, onClick }: { recording: Recording; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 surface-card hover:bg-surface-container-high transition-colors rounded-xl text-left"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-on-surface text-sm line-clamp-1">
          {recording.title || "Untitled recording"}
        </h3>
        {recording.status !== "ready" && <StatusPill status={recording.status} />}
      </div>

      <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-2">
        <span className="flex items-center gap-1">
          <ClockIcon size={12} />
          {formatDuration(recording.duration_seconds)}
        </span>
        <span>
          {formatDistanceToNow(new Date(recording.created_at), { addSuffix: true })}
        </span>
      </div>

      {recording.summary && (
        <p className="text-xs text-on-surface-variant/80 line-clamp-2 mb-2">
          {recording.summary}
        </p>
      )}

      {recording.tags && recording.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recording.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="chip text-[10px]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

export default function VaultHomePage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const router = useRouter();
  const [vault, setVault] = useState<Vault | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePrompt, setActivePrompt] = useState<{ id: string; text: string } | null>(null);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const [vaultRes, recRes] = await Promise.all([
      supabase.from("vaults").select("*").eq("id", vaultId).single(),
      supabase
        .from("recordings")
        .select("*")
        .eq("vault_id", vaultId)
        .order("created_at", { ascending: false }),
    ]);

    if (vaultRes.data) setVault(vaultRes.data as Vault);
    if (recRes.data) setRecordings(recRes.data as Recording[]);

    // Load daily prompt if applicable
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("prompt_cadence")
        .eq("id", user.id)
        .single();

      if (profile && profile.prompt_cadence !== "off") {
        // Get a prompt that hasn't been shown
        const { data: logs } = await supabase
          .from("prompt_logs")
          .select("prompt_id")
          .eq("user_id", user.id);

        const usedIds = logs?.map((l) => l.prompt_id) || [];

        let query = supabase.from("prompts").select("*").limit(1);
        if (usedIds.length > 0) {
          query = query.not("id", "in", `(${usedIds.join(",")})`);
        }
        const { data: prompts } = await query;
        if (prompts && prompts.length > 0) {
          setActivePrompt({ id: prompts[0].id, text: prompts[0].text });
        }
      }
    }

    setLoading(false);
  }, [vaultId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSkipPrompt = async () => {
    if (!activePrompt) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("prompt_logs").insert({
        user_id: user.id,
        prompt_id: activePrompt.id,
        action: "skipped",
      });
    }
    setActivePrompt(null);
  };

  const handleStartPrompt = () => {
    if (!activePrompt) return;
    router.push(`/vault/${vaultId}/record?prompt=${activePrompt.id}&text=${encodeURIComponent(activePrompt.text)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <WaveformIcon size={32} className="text-primary" />
          <p className="text-sm text-on-surface-variant">Loading stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-on-surface">
            {vault?.name || "Vault"}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {recordings.length} {recordings.length === 1 ? "story" : "stories"}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <WaveformIcon size={20} className="text-primary" />
        </div>
      </div>

      {/* Daily Prompt Banner */}
      {activePrompt && (
        <div className="surface-card p-4 mb-4 border border-primary/20">
          <p className="text-xs text-primary font-medium mb-1">Today&apos;s prompt</p>
          <p className="text-sm text-on-surface mb-3">{activePrompt.text}</p>
          <div className="flex gap-2">
            <button onClick={handleStartPrompt} className="btn-primary text-xs px-4 py-2">
              <MicIcon size={14} className="mr-1.5" /> Start recording
            </button>
            <button onClick={handleSkipPrompt} className="btn-text text-xs">
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Recordings Timeline */}
      {recordings.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-container flex items-center justify-center">
            <MicIcon size={28} className="text-on-surface-variant/50" />
          </div>
          <p className="text-on-surface-variant font-medium mb-1">No stories yet</p>
          <p className="text-xs text-on-surface-variant/60 mb-4">
            Tap the microphone to record your first story
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {recordings.map((rec) => (
            <RecordingCard
              key={rec.id}
              recording={rec}
              onClick={() => router.push(`/vault/${vaultId}/recording/${rec.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
