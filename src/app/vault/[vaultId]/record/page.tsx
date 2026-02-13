"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { MicIcon, StopIcon, PauseIcon, PlayIcon, ChevronLeftIcon, LockIcon } from "@/components/icons";
import { v4 as uuidv4 } from "uuid";

const MAX_DAILY_SECONDS = 600; // 10 minutes
const FREE_RECORDING_LIMIT = 3;

export default function RecordPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const vaultId = params.vaultId as string;
  const promptId = searchParams.get("prompt");
  const promptText = searchParams.get("text");
  const router = useRouter();
  const supabase = createClient();

  const [remainingSeconds, setRemainingSeconds] = useState(MAX_DAILY_SECONDS);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const maxRecordSeconds = Math.min(remainingSeconds, MAX_DAILY_SECONDS);
  const { isRecording, isPaused, elapsedSeconds, startRecording, stopRecording, pauseRecording, resumeRecording, audioLevel } = useAudioRecorder(maxRecordSeconds);

  const checkLimits = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const { data: usageLog } = await supabase
      .from("usage_logs")
      .select("seconds_recorded_total")
      .eq("user_id", user.id)
      .eq("date_yyyy_mm_dd", today)
      .single();

    const usedToday = usageLog?.seconds_recorded_total || 0;
    const remaining = Math.max(0, MAX_DAILY_SECONDS - usedToday);
    setRemainingSeconds(remaining);

    if (remaining <= 0) {
      setBlocked(true);
      setBlockReason("You've reached your 10-minute daily recording limit. Come back tomorrow!");
      setLoading(false);
      return;
    }

    // Check paywall (3 free recordings)
    const { data: vault } = await supabase
      .from("vaults")
      .select("is_pro")
      .eq("id", vaultId)
      .single();

    if (vault && !vault.is_pro) {
      const { data: readyRecs } = await supabase
        .from("recordings")
        .select("id")
        .eq("vault_id", vaultId)
        .eq("status", "ready");

      const readyCount = readyRecs?.length || 0;
      if (readyCount >= FREE_RECORDING_LIMIT) {
        setBlocked(true);
        setBlockReason("Your vault has used all 3 free recordings. Upgrade to Pro to continue recording.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  }, [vaultId, supabase]);

  useEffect(() => {
    checkLimits();
  }, [checkLimits]);

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const recordingId = uuidv4();
      const filePath = `${vaultId}/${recordingId}.webm`;

      // Upload audio
      const { error: uploadErr } = await supabase.storage
        .from("recordings")
        .upload(filePath, blob, { contentType: "audio/webm" });
      if (uploadErr) throw uploadErr;

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from("recordings")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      // Create recording
      const { error: recErr } = await supabase.from("recordings").insert({
        id: recordingId,
        vault_id: vaultId,
        created_by_user_id: user.id,
        audio_url: urlData?.signedUrl || filePath,
        duration_seconds: elapsedSeconds,
        status: "processing",
        prompt_id: promptId || null,
      });
      if (recErr) throw recErr;

      // Update usage log
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date_yyyy_mm_dd", today)
        .single();

      if (existing) {
        await supabase
          .from("usage_logs")
          .update({ seconds_recorded_total: existing.seconds_recorded_total + elapsedSeconds })
          .eq("id", existing.id);
      } else {
        await supabase.from("usage_logs").insert({
          user_id: user.id,
          date_yyyy_mm_dd: today,
          seconds_recorded_total: elapsedSeconds,
        });
      }

      // Log prompt action if applicable
      if (promptId) {
        await supabase.from("prompt_logs").insert({
          user_id: user.id,
          prompt_id: promptId,
          action: "started",
        });
      }

      // Trigger background processing
      fetch(`/api/recordings/${recordingId}/process`, { method: "POST" }).catch(() => {});

      router.push(`/vault/${vaultId}/recording/${recordingId}`);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload recording. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-pulse text-sm text-on-surface-variant">Checking limits...</div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="touch-target -ml-2 mb-4 text-on-surface-variant">
          <ChevronLeftIcon size={20} />
        </button>
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-error-container/30 flex items-center justify-center">
            <LockIcon size={32} className="text-error" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface mb-2">Recording locked</h2>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto mb-6">
            {blockReason}
          </p>
          {blockReason.includes("Pro") && (
            <button
              onClick={() => router.push(`/vault/${vaultId}/settings`)}
              className="btn-primary"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col min-h-[80vh]">
      <button onClick={() => router.back()} className="touch-target -ml-2 mb-2 text-on-surface-variant">
        <ChevronLeftIcon size={20} />
      </button>

      {promptText && (
        <div className="surface-card p-4 mb-6 border border-primary/20">
          <p className="text-xs text-primary font-medium mb-1">Prompt</p>
          <p className="text-sm text-on-surface">{decodeURIComponent(promptText)}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Timer */}
        <div className="mb-8 text-center">
          <p className="text-5xl font-light text-on-surface tracking-wide font-mono">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-xs text-on-surface-variant mt-2">
            {formatTime(remainingSeconds - elapsedSeconds)} remaining today
          </p>
        </div>

        {/* Audio level indicator */}
        {isRecording && (
          <div className="flex items-center gap-1 mb-8 h-8">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-primary transition-all duration-75"
                style={{
                  height: `${Math.max(4, audioLevel * 32 * (1 + Math.sin(i * 0.5 + Date.now() * 0.003) * 0.3))}px`,
                  opacity: audioLevel > 0.02 ? 0.4 + audioLevel * 0.6 : 0.2,
                }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-6">
          {isRecording && (
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              {isPaused ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
            </button>
          )}

          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={uploading}
              className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-on hover:brightness-110 active:brightness-95 transition-all shadow-lg disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-8 h-8 border-2 border-primary-on/30 border-t-primary-on rounded-full animate-spin" />
              ) : (
                <MicIcon size={32} />
              )}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-20 h-20 rounded-full bg-error flex items-center justify-center text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg"
            >
              <StopIcon size={32} />
            </button>
          )}

          {isRecording && <div className="w-14 h-14" />}
        </div>

        {!isRecording && !uploading && (
          <p className="text-xs text-on-surface-variant mt-6">
            Tap to start recording
          </p>
        )}
        {uploading && (
          <p className="text-xs text-primary mt-6">
            Uploading your story...
          </p>
        )}
      </div>
    </div>
  );
}
