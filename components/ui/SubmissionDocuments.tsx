"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Doc = {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  created_at: string;
};

const DOC_TYPES = [
  { value: "rfp_file", label: "The agency's RFP file" },
  { value: "other", label: "Other" },
];

// Replaces the old BidDocuments.tsx — same idea, but works against
// submissions/submission_documents instead of the old bids/bid_documents
// tables, which no longer exist after the schema reset.
export function SubmissionDocuments({ submissionId }: { submissionId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState("rfp_file");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("submission_documents")
      .select("id, document_type, file_name, file_url, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs(data ?? []));
  }, [submissionId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const path = `${submissionId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("rfp-documents")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("rfp-documents").getPublicUrl(path);

    const { data: newDoc, error: insertError } = await supabase
      .from("submission_documents")
      .insert({
        submission_id: submissionId,
        document_type: docType,
        file_name: file.name,
        file_url: publicUrl,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      setError(insertError?.message ?? "Upload saved, but couldn't record it.");
      setUploading(false);
      return;
    }

    setDocs((d) => [newDoc, ...d]);
    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(id: string) {
    await supabase.from("submission_documents").delete().eq("id", id);
    setDocs((d) => d.filter((doc) => doc.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer">
          {uploading ? "Uploading…" : "Choose file"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && <p className="text-body-md text-error">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No files attached yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between px-3 py-2 rounded border border-outline-variant bg-surface"
            >
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-md text-secondary hover:underline"
              >
                {doc.file_name}
              </a>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-error text-label-md hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
