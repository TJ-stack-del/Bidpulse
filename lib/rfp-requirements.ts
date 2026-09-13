import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubmissionRfpDocuments } from "@/lib/rfp-documents";

// Real fix for the "auto-draft doesn't pull items from the loaded RFP" gap:
// generate-draft/route.ts otherwise only ever sees the client's own short
// intake `scope` text, never the actual RFP document a client uploads via
// SubmissionDocuments.tsx (submission_documents rows with
// document_type = 'rfp_file', stored in the private rfp-documents bucket).
// This extracts concrete, compliance-relevant requirements from those files
// via the same Claude document-understanding approach already proven out in
// extract-from-document/route.ts, and caches the result on the submission
// row (see the add_rfp_requirements_cache migration) so a second draft
// regeneration doesn't re-run a slow, real-money LLM call for no reason.

export type RfpRequirement = {
  requirement: string;
  detail: string;
  // Added for the admin-review bottleneck: reviewing a compliance-matrix
  // row used to mean re-reading the whole source document to confirm it.
  // quote is the exact sentence the requirement was pulled from (never
  // paraphrased, so it's Ctrl+F-able in the real RFP); page is a
  // best-effort locator on top of that -- trust the quote first, since a
  // wrong page number is a minor inconvenience but a paraphrased "quote"
  // would defeat the whole point.
  quote: string;
  page: number | null;
};

const SYSTEM_PROMPT = `You extract concrete, compliance-relevant requirements from US government solicitation documents (RFPs, RFQs, sources-sought notices, task orders, etc.) for a small-business bidding platform. This platform never fabricates facts in anything it generates -- only extract a requirement if the document actually states it.

Read the provided document(s) and respond with ONLY a JSON array of objects, each with exactly these keys:
- "requirement": a short label for the requirement (under 10 words), e.g. "Bid bond", "General liability insurance minimum", "Page limit", "Required certification"
- "detail": the specific detail as stated in the document -- the actual percentage, dollar amount, page count, certification name, deadline, or format rule. Quote or closely paraphrase the document's own language. Never invent a plausible-sounding number or fact that isn't actually in the document.
- "quote": the exact sentence (or short span, under 300 characters) from the document that this requirement is based on. Copy it VERBATIM, character-for-character -- do not paraphrase, summarize, or clean it up. A human will search the original document for this exact text, so it must match. Never fabricate a quote.
- "page": your best-effort page number (an integer, 1-indexed) where that quote appears. If you genuinely cannot determine the page, use null -- never guess a number you're not reasonably confident in.

Only include requirements that are concrete and actionable for bid preparation: bonding/insurance minimums and types, required certifications or licenses, page/format limits, required forms or attachments, evaluation criteria categories, small-business/set-aside participation goals, submission deadline and method, and any other explicit compliance condition. Do NOT include generic background/history content or anything not stated as an actual requirement.

If multiple documents are provided, extract from all of them combined, without duplicating a requirement that appears in more than one. If nothing in the document(s) states a requirement like this, respond with an empty array []. Limit to the 15 most important requirements if there are more. Respond with nothing but that JSON array -- no markdown code fences, no commentary.`;

function coerceRequirements(parsed: unknown): RfpRequirement[] {
  if (!Array.isArray(parsed)) return [];
  const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const out: RfpRequirement[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const requirement = asString(record.requirement);
    const detail = asString(record.detail);
    const quote = asString(record.quote) ?? "";
    const page = typeof record.page === "number" && Number.isInteger(record.page) && record.page > 0 ? record.page : null;
    if (requirement && detail) out.push({ requirement, detail, quote, page });
  }
  return out;
}

// Best-effort throughout: any failure (a file that won't download, an
// unsupported type, a bad LLM response) just means fewer/no RFP-sourced
// rows make it into the draft, never a broken generate-draft request --
// the route's existing scope-text-only behavior is always a safe fallback.
export async function getOrExtractRfpRequirements(
  supabase: SupabaseClient,
  submission: { id: string; rfp_requirements: RfpRequirement[] | null; rfp_requirements_extracted_at: string | null }
): Promise<RfpRequirement[]> {
  const { blocks: content, newestDocAt } = await getSubmissionRfpDocuments(supabase, submission.id);
  if (newestDocAt === null) return [];

  if (
    submission.rfp_requirements &&
    submission.rfp_requirements_extracted_at &&
    submission.rfp_requirements_extracted_at > newestDocAt
  ) {
    return submission.rfp_requirements;
  }

  if (content.length === 0) return [];
  content.push({ type: "text", text: "Extract the requirements described in the system prompt from the document(s) above." });

  const anthropic = new Anthropic();
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
  } catch {
    return [];
  }

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text.trim());
  } catch {
    return [];
  }

  const requirements = coerceRequirements(parsed);

  // Best-effort cache write -- a failure here shouldn't fail the request
  // that's already got a perfectly good result to return.
  await supabase
    .from("submissions")
    .update({ rfp_requirements: requirements, rfp_requirements_extracted_at: new Date().toISOString() })
    .eq("id", submission.id);

  return requirements;
}
