import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Background processing pipeline for recordings
// Transcribes audio, generates summary and tags
export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  const { recordingId } = await params;
  const supabase = createServiceClient();

  try {
    // Get the recording
    const { data: recording, error: recErr } = await supabase
      .from("recordings")
      .select("*")
      .eq("id", recordingId)
      .single();

    if (recErr || !recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (recording.status !== "processing") {
      return NextResponse.json({ error: "Recording not in processing state" }, { status: 400 });
    }

    // Download audio from storage
    const audioPath = `${recording.vault_id}/${recording.id}.webm`;
    const { data: audioData, error: downloadErr } = await supabase.storage
      .from("recordings")
      .download(audioPath);

    if (downloadErr || !audioData) {
      console.error("Failed to download audio:", downloadErr);
      await supabase
        .from("recordings")
        .update({ status: "failed" })
        .eq("id", recordingId);
      return NextResponse.json({ error: "Failed to download audio" }, { status: 500 });
    }

    let transcriptText = "";
    let segments: { start_ms: number; end_ms: number; text: string }[] = [];

    // Try OpenAI Whisper API for transcription
    if (process.env.OPENAI_API_KEY) {
      try {
        const formData = new FormData();
        formData.append("file", audioData, "recording.webm");
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "segment");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          transcriptText = whisperData.text || "";

          if (whisperData.segments) {
            segments = whisperData.segments.map((seg: { start: number; end: number; text: string }) => ({
              start_ms: Math.round(seg.start * 1000),
              end_ms: Math.round(seg.end * 1000),
              text: seg.text.trim(),
            }));
          }
        } else {
          console.error("Whisper API error:", await whisperRes.text());
          throw new Error("Whisper API failed");
        }
      } catch (err) {
        console.error("Transcription error:", err);
        // Fall back to placeholder
        transcriptText = "";
      }
    }

    // If no transcription, create placeholder segments
    if (!transcriptText && segments.length === 0) {
      const durationMs = recording.duration_seconds * 1000;
      segments = [
        {
          start_ms: 0,
          end_ms: durationMs,
          text: "[Transcription unavailable - configure OPENAI_API_KEY for Whisper transcription]",
        },
      ];
      transcriptText = segments[0].text;
    }

    // Insert segments
    if (segments.length > 0) {
      const segmentRows = segments.map((seg) => ({
        recording_id: recordingId,
        start_ms: seg.start_ms,
        end_ms: seg.end_ms,
        text: seg.text,
      }));

      await supabase.from("recording_segments").insert(segmentRows);
    }

    // Generate summary and tags using OpenAI (if available)
    let summary = "";
    let tags: string[] = [];

    if (process.env.OPENAI_API_KEY && transcriptText && !transcriptText.startsWith("[Transcription")) {
      try {
        const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You analyze family story transcripts. Given a transcript, provide:
1. A brief 1-2 sentence summary capturing the essence of the story
2. 3-7 relevant tags (single words or short phrases)

Respond in JSON format: { "summary": "...", "tags": ["..."] }`,
              },
              {
                role: "user",
                content: `Transcript:\n${transcriptText}`,
              },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const content = chatData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            summary = parsed.summary || "";
            tags = Array.isArray(parsed.tags) ? parsed.tags : [];
          }
        }
      } catch (err) {
        console.error("Summary generation error:", err);
      }
    }

    // If no AI summary, generate a basic one
    if (!summary && transcriptText && !transcriptText.startsWith("[Transcription")) {
      summary = transcriptText.length > 120
        ? transcriptText.substring(0, 120).trim() + "..."
        : transcriptText;
    }

    // Update recording
    await supabase
      .from("recordings")
      .update({
        status: "ready",
        summary: summary || null,
        tags: tags.length > 0 ? tags : [],
      })
      .eq("id", recordingId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Processing error:", err);

    // Mark as failed
    await supabase
      .from("recordings")
      .update({ status: "failed" })
      .eq("id", recordingId);

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
