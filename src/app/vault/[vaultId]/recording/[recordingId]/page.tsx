"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Recording, RecordingSegment } from "@/types/database";
import {
  ChevronLeftIcon, PlayIcon, PauseIcon, RewindIcon, ForwardIcon,
  TagIcon, XIcon, PlusIcon
} from "@/components/icons";
import { format } from "date-fns";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordingDetailPage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const recordingId = params.recordingId as string;
  const router = useRouter();
  const supabase = createClient();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [role, setRole] = useState<string>("viewer");

  const audioUrl = recording?.audio_url || "";
  const player = useAudioPlayer(audioUrl);

  const rates = [1, 1.25, 1.5];

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("vault_members")
      .select("role")
      .eq("vault_id", vaultId)
      .eq("user_id", user.id)
      .single();
    if (member) setRole(member.role);

    const [recRes, segRes] = await Promise.all([
      supabase.from("recordings").select("*").eq("id", recordingId).single(),
      supabase
        .from("recording_segments")
        .select("*")
        .eq("recording_id", recordingId)
        .order("start_ms", { ascending: true }),
    ]);

    if (recRes.data) {
      setRecording(recRes.data as Recording);
      setTitleValue(recRes.data.title || "");
    }
    if (segRes.data) setSegments(segRes.data as RecordingSegment[]);
    setLoading(false);
  }, [recordingId, vaultId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for processing status
  useEffect(() => {
    if (!recording || recording.status !== "processing") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("recordings")
        .select("*")
        .eq("id", recordingId)
        .single();
      if (data && data.status !== "processing") {
        setRecording(data as Recording);
        if (data.status === "ready") {
          const { data: segs } = await supabase
            .from("recording_segments")
            .select("*")
            .eq("recording_id", recordingId)
            .order("start_ms", { ascending: true });
          if (segs) setSegments(segs as RecordingSegment[]);
        }
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [recording?.status, recordingId, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = role === "owner" || role === "member";

  const saveTitle = async () => {
    if (!recording) return;
    await supabase
      .from("recordings")
      .update({ title: titleValue || null })
      .eq("id", recording.id);
    setRecording({ ...recording, title: titleValue || null });
    setEditingTitle(false);
  };

  const addTag = async () => {
    if (!recording || !newTag.trim()) return;
    const updatedTags = [...(recording.tags || []), newTag.trim()];
    await supabase
      .from("recordings")
      .update({ tags: updatedTags })
      .eq("id", recording.id);
    setRecording({ ...recording, tags: updatedTags });
    setNewTag("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    if (!recording) return;
    const updatedTags = recording.tags.filter((t) => t !== tag);
    await supabase
      .from("recordings")
      .update({ tags: updatedTags })
      .eq("id", recording.id);
    setRecording({ ...recording, tags: updatedTags });
  };

  if (loading || !recording) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-pulse text-sm text-on-surface-variant">Loading recording...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <button onClick={() => router.push(`/vault/${vaultId}`)} className="touch-target -ml-2 mb-4 text-on-surface-variant">
        <ChevronLeftIcon size={20} />
      </button>

      {/* Title */}
      <div className="mb-4">
        {editingTitle && canEdit ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="input-field flex-1"
              placeholder="Give this story a title..."
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            />
            <button onClick={saveTitle} className="btn-tonal text-xs px-3">Save</button>
            <button onClick={() => setEditingTitle(false)} className="btn-text text-xs">Cancel</button>
          </div>
        ) : (
          <h1
            className={`text-xl font-semibold text-on-surface ${canEdit ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
            onClick={() => canEdit && setEditingTitle(true)}
          >
            {recording.title || "Untitled recording"}
          </h1>
        )}
        <p className="text-xs text-on-surface-variant mt-1">
          {format(new Date(recording.created_at), "MMM d, yyyy · h:mm a")} · {formatTime(recording.duration_seconds)}
        </p>
      </div>

      {/* Processing Status */}
      {recording.status === "processing" && (
        <div className="surface-card p-4 mb-4 border border-primary/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-primary">Transcribing your story...</p>
          </div>
        </div>
      )}

      {recording.status === "failed" && (
        <div className="surface-card p-4 mb-4 border border-error/20">
          <p className="text-sm text-error">Processing failed. The recording may still be playable.</p>
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && (
        <div className="surface-card p-4 mb-4">
          {/* Scrubber */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={player.duration || recording.duration_seconds}
              step={0.1}
              value={player.currentTime}
              onChange={(e) => player.seek(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
              <span>{formatTime(player.currentTime)}</span>
              <span>{formatTime(player.duration || recording.duration_seconds)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => player.skip(-15)} className="touch-target text-on-surface-variant hover:text-on-surface transition-colors">
              <RewindIcon size={22} />
              <span className="text-[9px] block -mt-0.5">15</span>
            </button>

            <button
              onClick={player.toggle}
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-on hover:brightness-110 transition-all"
            >
              {player.isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </button>

            <button onClick={() => player.skip(15)} className="touch-target text-on-surface-variant hover:text-on-surface transition-colors">
              <ForwardIcon size={22} />
              <span className="text-[9px] block -mt-0.5">15</span>
            </button>

            <button
              onClick={() => {
                const nextIdx = (rates.indexOf(player.playbackRate) + 1) % rates.length;
                player.setRate(rates[nextIdx]);
              }}
              className="touch-target text-xs font-mono text-on-surface-variant hover:text-primary bg-surface-container-high rounded-full px-2 py-1"
            >
              {player.playbackRate}x
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {recording.summary && (
        <div className="mb-4">
          <h2 className="text-xs font-medium text-on-surface-variant mb-1.5">Summary</h2>
          <p className="text-sm text-on-surface leading-relaxed">{recording.summary}</p>
        </div>
      )}

      {/* Tags */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TagIcon size={14} className="text-on-surface-variant" />
          <h2 className="text-xs font-medium text-on-surface-variant">Tags</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recording.tags?.map((tag) => (
            <span key={tag} className="chip group relative">
              {tag}
              {canEdit && (
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XIcon size={10} />
                </button>
              )}
            </span>
          ))}
          {canEdit && !showTagInput && (
            <button
              onClick={() => setShowTagInput(true)}
              className="chip border border-dashed border-outline-variant hover:border-primary transition-colors"
            >
              <PlusIcon size={12} className="mr-1" /> Add tag
            </button>
          )}
          {showTagInput && (
            <div className="flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="input-field text-xs h-8 w-32"
                placeholder="Tag name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag();
                  if (e.key === "Escape") setShowTagInput(false);
                }}
              />
              <button onClick={addTag} className="text-xs text-primary font-medium">Add</button>
            </div>
          )}
        </div>
      </div>

      {/* Transcript */}
      {segments.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-on-surface-variant mb-3">Transcript</h2>
          <div className="space-y-1">
            {segments.map((seg) => {
              const isActive =
                player.currentTime >= seg.start_ms / 1000 &&
                player.currentTime < seg.end_ms / 1000;
              return (
                <button
                  key={seg.id}
                  onClick={() => {
                    player.seek(seg.start_ms / 1000);
                    if (!player.isPlaying) player.play();
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-colors ${
                    isActive
                      ? "bg-primary/15 border border-primary/20"
                      : "hover:bg-surface-container-high"
                  }`}
                >
                  <span className="text-[10px] text-on-surface-variant font-mono mr-2">
                    {formatTime(seg.start_ms / 1000)}
                  </span>
                  <span className={`text-sm ${isActive ? "text-primary" : "text-on-surface"}`}>
                    {seg.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
