import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getRoast, type ResumeContent } from "@/lib/ai-provider";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let roastId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    roastId = typeof body?.roast_id === "string" ? body.roast_id : undefined;

    if (!roastId) {
      return NextResponse.json({ error: "Missing or invalid roast_id." }, { status: 400 });
    }

    const { data: roast, error: fetchErr } = await supabaseAdmin
      .from("roasts")
      .select("id, status")
      .eq("id", roastId)
      .single();

    if (fetchErr || !roast) {
      return NextResponse.json({ error: "Roast request not found." }, { status: 404 });
    }

    if (roast.status !== "pending") {
      return NextResponse.json({ ok: true, already: roast.status });
    }

    await supabaseAdmin
      .from("roasts")
      .update({ status: "processing" })
      .eq("id", roastId);

    processRoast(roastId).catch((err) => {
      console.error("[/api/roast] uncaught processing error:", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown server error.";
    console.error("[/api/roast] outer error:", err);
    if (roastId) await markFailed(roastId, msg).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ============================================================
   Background pipeline
   ============================================================ */
async function processRoast(roastId: string): Promise<void> {
  try {
    const { data: roast, error: fetchErr } = await supabaseAdmin
      .from("roasts")
      .select("*")
      .eq("id", roastId)
      .single();

    if (fetchErr || !roast) {
      throw new Error(`Could not load roast: ${fetchErr?.message ?? "not found"}`);
    }

    // ── Download file from Storage ─────────────────────────
    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
      .from("resumes")
      .download(roast.file_path);

    if (dlErr || !fileBlob) {
      throw new Error(`Could not download file: ${dlErr?.message ?? "unknown"}`);
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    // ── Build ResumeContent ────────────────────────────────
    //
    //  Strategy:
    //    PNG  → always use vision (image → base64 data URI)
    //    PDF  → try text extraction first (fast + accurate for digital PDFs)
    //           if extracted text is too thin (scanned / image-only PDF),
    //           fall back to vision so the model reads it visually
    //
    let resumeContent: ResumeContent;

    if (roast.file_type === "image/png" || roast.file_type === "image/jpeg") {
      // ── Vision path: encode image as base64 data URI ──
      const base64   = buffer.toString("base64");
      const mimeType = roast.file_type as "image/png" | "image/jpeg";
      resumeContent  = {
        type:    "image",
        dataUri: `data:${mimeType};base64,${base64}`,
      };

      // Store a note so the result row records the mode used
      await supabaseAdmin
        .from("roasts")
        .update({ parsed_text: "[vision mode — image sent directly to model]" })
        .eq("id", roastId);

    } else if (roast.file_type === "application/pdf") {
      // ── Text-extraction path ──
      const pdfParse  = (await import("pdf-parse")).default;
      const parsed    = await pdfParse(buffer);
      const extracted = parsed.text?.trim() ?? "";

      if (extracted.length >= 120) {
        // Enough text — use it. Fastest and most token-efficient path.
        resumeContent = { type: "text", content: extracted };
        await supabaseAdmin
          .from("roasts")
          .update({ parsed_text: extracted })
          .eq("id", roastId);

      } else {
        // Too little text → scanned / image-based PDF.
        // Convert to base64 and let the model read it visually.
        // Most vision-capable models (GPT-4o, Claude, etc.) accept PDFs as
        // base64 data URIs via the image_url content block. For models that
        // don't, we encode as image/png fallback using the raw bytes.
        const base64 = buffer.toString("base64");
        resumeContent = {
          type:    "image",
          dataUri: `data:application/pdf;base64,${base64}`,
        };
        await supabaseAdmin
          .from("roasts")
          .update({ parsed_text: "[vision mode — scanned PDF sent directly to model]" })
          .eq("id", roastId);
      }
    } else {
      throw new Error(
        `Unsupported file type: ${roast.file_type}. Please upload a PDF or PNG.`
      );
    }

    // ── Call the AI ────────────────────────────────────────
    const rowTier  = roast.tier === "plus" || roast.tier === "premium" ? roast.tier : "free";
    const result   = await getRoast(resumeContent, roast.target_company, rowTier);

    // ── Persist ────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from("roasts")
      .update({
        status:       "completed",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", roastId);

    if (updateErr) throw new Error(`Could not save result: ${updateErr.message}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing failed.";
    console.error(`[processRoast ${roastId}]`, err);
    await markFailed(roastId, msg);
  }
}

async function markFailed(roastId: string, message: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("roasts")
      .update({
        status:        "failed",
        error_message: message.slice(0, 500),
        completed_at:  new Date().toISOString(),
      })
      .eq("id", roastId);
  } catch (e) {
    console.error("[markFailed] secondary failure:", e);
  }
}
