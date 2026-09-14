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

export type UploadAndInsertResult<T> =
  | { row: T; signedUrl: string | null; error: null }
  | { row: null; signedUrl: null; error: string };

// The real "add a record with an optional document" sequence -- upload
// (skipped entirely when there's no file), insert, roll the upload back on
// a failed insert (removeRfpDocument), sign the stored path for immediate
// display -- was duplicated near-identically across CertificationsSection,
// InsuranceBondingSection (twice, once per record type it manages), and
// DocumentLibrarySection. Collapsed here since a code review flagged the
// triplication; each caller still owns its own field validation and local
// state update, just not this sequence.
export async function uploadAndInsertRecord<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  params: {
    // Where to store the file, e.g. `${clientId}/certifications/${Date.now()}-${file.name}`.
    // Ignored when `file` is null (an optional-document record with none attached).
    path: string;
    file: File | null;
    table: string;
    // Fields besides the file columns, which are set automatically.
    payload: Record<string, unknown>;
    // Defaults to "file_url"/"file_name" -- client_past_performance's
    // photo evidence uses photo_url/photo_file_name instead, since it's a
    // different concept (a project photo, not a compliance document) on a
    // table that isn't otherwise document-shaped.
    fileUrlColumn?: string;
    fileNameColumn?: string;
    // Shown when the insert fails with no more specific Supabase message --
    // a caller-supplied string here, used directly, rather than every
    // caller string-matching this function's own generic text afterward
    // (a real fragility a review caught: the match silently breaks the
    // moment this default wording changes).
    genericErrorMessage?: string;
  }
): Promise<UploadAndInsertResult<T>> {
  const fileUrlColumn = params.fileUrlColumn ?? "file_url";
  const fileNameColumn = params.fileNameColumn ?? "file_name";

  let storedPath: string | null = null;
  if (params.file) {
    const uploaded = await uploadRfpDocument(supabase, params.path, params.file);
    if (uploaded.error) return { row: null, signedUrl: null, error: uploaded.error };
    storedPath = uploaded.path;
  }

  const { data: newRow, error: insertError } = await supabase
    .from(params.table)
    .insert({ ...params.payload, [fileUrlColumn]: storedPath, [fileNameColumn]: params.file?.name ?? null })
    .select()
    .single();

  if (insertError || !newRow) {
    // Best-effort: the insert genuinely failed here (a real Postgrest
    // error came back), so the upload above is now truly orphaned. This
    // does NOT run on a request that times out client-side after actually
    // succeeding server-side -- that's a real, separate edge case (the
    // network response is lost, not the insert) with no clean fix from
    // this side of the request; flagged, not solved, by design.
    await removeRfpDocument(supabase, storedPath);
    return { row: null, signedUrl: null, error: insertError?.message ?? params.genericErrorMessage ?? "Couldn't save the record." };
  }

  const signedUrl = storedPath ? await signRfpDocumentUrl(supabase, storedPath) : null;
  return { row: newRow as T, signedUrl, error: null };
}

// The mirror of uploadAndInsertRecord for removal: delete the row and, only
// once that's actually confirmed (not assumed), remove its file. Using
// `.delete().select(fileUrlColumn)` returns the deleted row's own data in
// the same round trip -- both fixes a real bug a follow-up review caught
// (the previous per-component code deleted the storage file unconditionally,
// even when the DB delete itself had failed, silently leaving a live row
// with a now-broken link) and removes the separate SELECT every caller did
// beforehand.
export async function deleteRecordAndFile(
  supabase: SupabaseClient,
  table: string,
  id: string,
  fileUrlColumn: string = "file_url"
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from(table).delete().eq("id", id).select(fileUrlColumn).single();
  if (error) return { error: error.message };
  const path = (data as unknown as Record<string, unknown> | null)?.[fileUrlColumn];
  await removeRfpDocument(supabase, typeof path === "string" ? path : null);
  return { error: null };
}
