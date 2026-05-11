import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const deleteAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // First check if a profiles row exists for this user
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (selectErr) {
      console.error("[schedule-delete] select error:", selectErr);
      return NextResponse.json(
        { error: `Database read failed: ${selectErr.message}` },
        { status: 500 }
      );
    }

    let writeError;

    if (existing) {
      // Row exists — update it
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ scheduled_delete_at: deleteAt })
        .eq("id", userId);
      writeError = error;
    } else {
      // No profile row yet — insert one
      const { error } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, scheduled_delete_at: deleteAt });
      writeError = error;
    }

    if (writeError) {
      console.error("[schedule-delete] write error:", writeError);
      return NextResponse.json(
        { error: `Database write failed: ${writeError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, scheduledFor: deleteAt });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[schedule-delete] caught:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
