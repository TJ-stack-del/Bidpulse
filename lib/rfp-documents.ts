import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectDocumentKind, type DocumentKind } from "@/lib/document-parsing";

// Shared by lib/rfp-requirements.ts (compliance-matrix extraction) and
// lib/bid-estimation.ts (bid-sizing extraction) -- both need the same "turn
// a submission's uploaded RFP file(s) into Claude document content blocks"
// step, extracted here once both callers actually needed it identically
// rather than duplicating the download/convert loop a second time.

export type RfpContentBlock = Anthropic.TextBlockParam | Anthropic.DocumentBlockParam;

type RfpFileRow = { file_name: string; file_url: string; created_at: string };

async function fileToContentBlock(kind: DocumentKind, buffer: Buffer): Promise<RfpContentBlock[] | null> {
  if (kind === "pdf") {
    return [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      },
    ];
  }
  const text = kind === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf-8");
  if (!text.trim()) return null;
  return [{ type: "text", text: text.trim() }];
}

// Returns both the built content blocks and the newest document's
// created_at (for cache-invalidation comparisons by callers) -- null docs
// list means nothing uploaded yet, distinct from "uploaded but unreadable."
export async function getSubmissionRfpDocuments(
  supabase: SupabaseClient,
  submissionId: string
): Promise<{ blocks: RfpContentBlock[]; newestDocAt: string | null }> {
  const { data: rfpDocs } = await supabase
    .from("submission_documents")
    .select("file_name, file_url, created_at")
    .eq("submission_id", submissionId)
    .eq("document_type", "rfp_file")
    .order("created_at", { ascending: true });

  const docs = (rfpDocs ?? []) as RfpFileRow[];
  if (docs.length === 0) return { blocks: [], newestDocAt: null };

  const newestDocAt = docs.reduce((max, d) => (d.created_at > max ? d.created_at : max), docs[0].created_at);

  const blocks: RfpContentBlock[] = [];
  for (const doc of docs) {
    const kind = detectDocumentKind("", doc.file_name);
    if (!kind) continue;
    const { data: blob, error } = await supabase.storage.from("rfp-documents").download(doc.file_url);
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const block = await fileToContentBlock(kind, buffer);
    if (!block) continue;
    blocks.push({ type: "text", text: `--- Document: ${doc.file_name} ---` });
    blocks.push(...block);
  }

  return { blocks, newestDocAt };
}
