"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { signRfpDocumentUrl, uploadRfpDocument, removeRfpDocument } from "@/lib/storage";

type ClientDocument = {
  id: string;
  doc_type: string;
  label: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "w9", label: "W-9" },
  { value: "non_collusion_affidavit", label: "Non-Collusion Affidavit" },
  { value: "capability_statement", label: "Capability Statement" },
  { value: "custom_rider", label: "Custom RFP rider" },
  { value: "other", label: "Other" },
];

function docLabel(doc: Pick<ClientDocument, "doc_type" | "label">) {
  if (doc.doc_type === "custom_rider" || doc.doc_type === "other") return doc.label || DOC_TYPES.find((d) => d.value === doc.doc_type)?.label || doc.doc_type;
  return DOC_TYPES.find((d) => d.value === doc.doc_type)?.label ?? doc.doc_type;
}

// Reusable RFP boilerplate a client keeps current themselves -- no verify
// workflow here (client_documents has no verified column at all, unlike
// certifications/insurance/bonding), a row's presence with a file IS
// "synced" for the UI's purposes. Every upload/list/remove call goes
// through the same rfp-documents bucket and uploadRfpDocument/
// signRfpDocumentUrl helpers as every other document feature in the app.
export function DocumentLibrarySection({
  clientId,
  initialDocuments,
}: {
  clientId: string;
  initialDocuments: ClientDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const idPrefix = useId();

  const needsLabel = docType === "custom_rider" || docType === "other";

  function resetForm() {
    setDocType(DOC_TYPES[0].value);
    setLabel("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a document to upload.");
      return;
    }
    if (needsLabel && !label.trim()) {
      setError("Enter a name for this document (e.g. \"Prevailing Wage Rider\").");
      return;
    }

    setSubmitting(true);

    const uploaded = await uploadRfpDocument(supabase, `${clientId}/documents/${docType}/${Date.now()}-${file.name}`, file);
    if (uploaded.error) {
      setError(uploaded.error);
      setSubmitting(false);
      return;
    }

    const { data: newDoc, error: insertError } = await supabase
      .from("client_documents")
      .insert({
        client_id: clientId,
        doc_type: docType,
        label: needsLabel ? label.trim() : null,
        file_url: uploaded.path,
        file_name: file.name,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      // Upload already succeeded above -- without this, a failed insert
      // here left the file permanently orphaned in storage.
      await removeRfpDocument(supabase, uploaded.path);
      setError(insertError?.message ?? "Couldn't record the document.");
      setSubmitting(false);
      return;
    }

    const signedUrl = await signRfpDocumentUrl(supabase, uploaded.path);
    setDocuments((d) => [{ ...newDoc, file_url: signedUrl }, ...d]);
    resetForm();
    setSubmitting(false);
  }

  // `file_url` in local state is always a signed URL -- re-reads the real
  // storage path from the DB rather than trying to derive it from that.
  async function handleRemove(id: string) {
    const { data: row } = await supabase.from("client_documents").select("file_url").eq("id", id).single();
    await supabase.from("client_documents").delete().eq("id", id);
    await removeRfpDocument(supabase, row?.file_url ?? null);
    setDocuments((d) => d.filter((doc) => doc.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap">
        <div>
          <label htmlFor={`${idPrefix}-doc-type`} className="text-label-md text-on-surface-variant block mb-1">Document type</label>
          <select
            id={`${idPrefix}-doc-type`}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {needsLabel && (
          <div>
            <label htmlFor={`${idPrefix}-label`} className="text-label-md text-on-surface-variant block mb-1">Name</label>
            <input
              id={`${idPrefix}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Prevailing Wage Rider"
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
        )}

        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${idPrefix}-file`} className="text-label-md text-on-surface-variant block mb-1">File</label>
          <label htmlFor={`${idPrefix}-file`} className="px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            {file ? file.name : "Choose file"}
            <input id={`${idPrefix}-file`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-4 bg-primary-container text-on-primary-container rounded text-label-md font-semibold hover:opacity-90 hover:-translate-y-0.5 transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {submitting && <Spinner />}
          {submitting ? "Uploading…" : "Add document"}
        </button>
      </form>

      {error && <p className="text-body-md text-error">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No documents added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap">
              <div>
                <p className="text-body-md text-on-surface font-bold">{docLabel(doc)}</p>
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-label-md text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm">
                    {doc.file_name ?? "View document"}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase bg-secondary-container text-on-secondary-container border-primary/20">
                  Synced
                </span>
                <button type="button" onClick={() => handleRemove(doc.id)} className="text-error text-label-md hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error rounded-sm">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
