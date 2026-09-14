import type { SupabaseClient } from "@supabase/supabase-js";

// submission_documents.file_url / deliverables.file_url /
// client_certifications.file_url store the bare storage path (not a public
// URL) as of the 2026-08-31 storage-privacy migration — the bucket is
// private, so every read site needs a fresh signed URL rather than being
// able to use the stored value directly. One hour is long enough to survive
// a page session; it's regenerated on every render, never persisted.
const RFP_DOCUMENTS_BUCKET = "rfp-documents";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function signRfpDocumentUrl(
  supabase: SupabaseClient,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(RFP_DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

// Signs the `file_url` field on a batch of rows in place — for the three
// server pages that select deliverables/certifications and pass them down
// as props (the DB value is always a path at this point, never a URL).
export async function signRfpDocumentUrls<T extends { file_url: string | null }>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => ({ ...row, file_url: await signRfpDocumentUrl(supabase, row.file_url) }))
  );
}

// The write-side counterpart to signRfpDocumentUrl -- every upload call
// site in the app duplicated `.storage.from("rfp-documents").upload(path,
// file)` inline (IntakeWizard.tsx, DeliverablesPanel.tsx,
// CertificationsSection.tsx, CompanyProfileClient.tsx) before this existed.
// Returns the stored path (never a public URL, matching every read site's
// expectation above) on success, or the real Supabase error on failure --
// callers decide how to surface that, same as they did with the inline
// version.
export async function uploadRfpDocument(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<{ path: string; error: null } | { path: null; error: string }> {
  const { error } = await supabase.storage.from(RFP_DOCUMENTS_BUCKET).upload(path, file);
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

// Real gap a code review caught: every "remove this record" button across
// certifications/insurance/bonding/documents only ever deleted the DB row,
// never the file it pointed at -- same gap on a failed insert right after a
// successful upload (the file lands in storage, the row never does).
// Best-effort by design: if the remove itself is what the user asked for,
// a failure to also delete the now-orphaned file shouldn't block that or
// surface as an error -- storage cost, not data integrity, is what's at
// stake here.
export async function removeRfpDocument(supabase: SupabaseClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from(RFP_DOCUMENTS_BUCKET).remove([path]);
}
