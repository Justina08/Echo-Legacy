"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Recording } from "@/types/database";
import { SearchIcon, ClockIcon } from "@/components/icons";
import { formatDistanceToNow } from "date-fns";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-primary/30 text-primary rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SearchPage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Recording & { matchSnippet?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setSearched(true);

    // Search recordings by title, summary, tags
    const { data: recordings } = await supabase
      .from("recordings")
      .select("*")
      .eq("vault_id", vaultId)
      .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
      .order("created_at", { ascending: false });

    // Search segments for transcript matches
    const { data: segmentMatches } = await supabase
      .from("recording_segments")
      .select("recording_id, text")
      .ilike("text", `%${q}%`);

    // Combine results
    const recordingMap = new Map<string, Recording & { matchSnippet?: string }>();

    recordings?.forEach((r) => {
      recordingMap.set(r.id, r as Recording & { matchSnippet?: string });
    });

    if (segmentMatches) {
      const segRecIds = [...new Set(segmentMatches.map((s) => s.recording_id))];
      if (segRecIds.length > 0) {
        const { data: segRecordings } = await supabase
          .from("recordings")
          .select("*")
          .eq("vault_id", vaultId)
          .in("id", segRecIds);

        segRecordings?.forEach((r) => {
          if (!recordingMap.has(r.id)) {
            const snippet = segmentMatches.find((s) => s.recording_id === r.id)?.text || "";
            recordingMap.set(r.id, { ...(r as Recording), matchSnippet: snippet });
          } else {
            const existing = recordingMap.get(r.id)!;
            if (!existing.matchSnippet) {
              existing.matchSnippet = segmentMatches.find((s) => s.recording_id === r.id)?.text;
            }
          }
        });
      }
    }

    setResults(Array.from(recordingMap.values()));
    setSearching(false);
  }, [vaultId, supabase]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-semibold text-on-surface mb-4">Search</h1>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setSearched(false);
            }
          }}
          placeholder="Search stories, transcripts, tags..."
          className="input-field pl-10"
          autoFocus
        />
      </form>

      {/* Results */}
      {searching && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      )}

      {!searching && searched && results.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon size={32} className="text-on-surface-variant/30 mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm">No results found for &quot;{query}&quot;</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-on-surface-variant mb-2">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((rec) => (
            <button
              key={rec.id}
              onClick={() => router.push(`/vault/${vaultId}/recording/${rec.id}`)}
              className="w-full p-4 surface-card hover:bg-surface-container-high transition-colors rounded-xl text-left"
            >
              <h3 className="font-medium text-on-surface text-sm line-clamp-1 mb-1">
                {highlightMatch(rec.title || "Untitled recording", query)}
              </h3>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant mb-1.5">
                <span className="flex items-center gap-1">
                  <ClockIcon size={12} />
                  {formatDuration(rec.duration_seconds)}
                </span>
                <span>{formatDistanceToNow(new Date(rec.created_at), { addSuffix: true })}</span>
              </div>
              {rec.matchSnippet && (
                <p className="text-xs text-on-surface-variant/70 line-clamp-2">
                  {highlightMatch(rec.matchSnippet, query)}
                </p>
              )}
              {!rec.matchSnippet && rec.summary && (
                <p className="text-xs text-on-surface-variant/70 line-clamp-2">
                  {highlightMatch(rec.summary, query)}
                </p>
              )}
              {rec.tags && rec.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {rec.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="chip text-[10px]">{highlightMatch(tag, query)}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
