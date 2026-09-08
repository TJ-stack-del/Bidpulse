// Shared by advance-if-deliverables-complete/route.ts and PacketButtons.tsx.
//
// generate-draft/route.ts deliberately returns a scaffold full of
// [bracketed instructions] instead of a blank page (see that file's own
// header comment — there's no LLM wired up, so it's a template fill-in an
// admin is expected to replace by hand before saving). Nothing anywhere in
// the pipeline previously checked whether that replacement actually
// happened: an admin could click "Auto-draft" then "Save text" without
// editing anything, and the stage-complete check only looked for *any*
// non-empty content — so a submission could reach deliverables_ready
// (with the client emailed that it's ready) and the client could then
// download a PDF that's still the raw unfilled template, brackets and all.
export function hasUnresolvedPlaceholders(content: string | null | undefined): boolean {
  if (!content) return false;
  return /\[[^\[\]]*\]/.test(content);
}
