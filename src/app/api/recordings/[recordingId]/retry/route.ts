import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  const { recordingId } = await params;
  const supabase = createServiceClient();

  // Reset status to processing
  const { error } = await supabase
    .from("recordings")
    .update({ status: "processing" })
    .eq("id", recordingId)
    .eq("status", "failed");

  if (error) {
    return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
  }

  // Re-trigger processing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${appUrl}/api/recordings/${recordingId}/process`, { method: "POST" }).catch(() => {});

  return NextResponse.json({ success: true });
}
