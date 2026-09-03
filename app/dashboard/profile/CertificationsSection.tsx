"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { signRfpDocumentUrl } from "@/lib/storage";

type Certification = {
  id: string;
  cert_type: string;
  other_label: string | null;
  certification_number: string | null;
  expiration_date: string | null;
  file_url: string | null;
  file_name: string | null;
  verified: boolean;
  created_at: string;
};

const CERT_TYPES = ["8(a)", "WOSB", "EDWOSB", "HUBZone", "SDVOSB", "VOSB", "JSEB", "DBE/SDB", "Other"];

function certLabel(cert: Pick<Certification, "cert_type" | "other_label">) {
  return cert.cert_type === "Other" ? cert.other_label || "Other" : cert.cert_type;
}

// Upload mechanics (bucket, path convention, upload -> save row) mirror
// components/ui/SubmissionDocuments.tsx — same storage bucket, just a
// client-scoped path instead of a submission-scoped one.
export function CertificationsSection({
  clientId,
  initialCertifications,
}: {
  clientId: string;
  initialCertifications: Certification[];
}) {
  const [certifications, setCertifications] = useState(initialCertifications);
  const [certType, setCertType] = useState(CERT_TYPES[0]);
  const [otherLabel, setOtherLabel] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  function resetForm() {
    setCertType(CERT_TYPES[0]);
    setOtherLabel("");
    setCertNumber("");
    setExpirationDate("");
    setFile(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (certType === "Other" && !otherLabel.trim()) {
      setError("Enter the certification name (e.g. MBE, DBE) for \"Other\".");
      return;
    }

    setSubmitting(true);

    // Document is optional at save time — a certification with no file sits
    // as "Not yet reviewed" indefinitely until one's attached. The document
    // only becomes required later, at the point an admin marks it Verified
    // (ClientCertifications.tsx's toggle enforces that, backed by a DB
    // constraint) — that's the actual gate on being treated as fact
    // anywhere generated paperwork reads client_certifications.
    let path: string | null = null;
    if (file) {
      path = `${clientId}/certifications/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("rfp-documents").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        setSubmitting(false);
        return;
      }
    }

    // The bucket is private — the DB stores the bare path, and every read
    // site (including this one, right after upload) generates its own
    // signed URL rather than persisting one, since a signed URL expires.
    const { data: newCert, error: insertError } = await supabase
      .from("client_certifications")
      .insert({
        client_id: clientId,
        cert_type: certType,
        other_label: certType === "Other" ? otherLabel.trim() : null,
        certification_number: certNumber.trim() || null,
        expiration_date: expirationDate || null,
        file_url: path,
        file_name: file ? file.name : null,
      })
      .select()
      .single();

    if (insertError || !newCert) {
      setError(insertError?.message ?? "Couldn't record the certification.");
      setSubmitting(false);
      return;
    }

    const signedUrl = path ? await signRfpDocumentUrl(supabase, path) : null;
    setCertifications((c) => [{ ...newCert, file_url: signedUrl }, ...c]);
    resetForm();
    setSubmitting(false);
  }

  async function handleRemove(id: string) {
    await supabase.from("client_certifications").delete().eq("id", id);
    setCertifications((c) => c.filter((cert) => cert.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAdd}
        className="border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap"
      >
        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Certification type</label>
          <select
            value={certType}
            onChange={(e) => setCertType(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface"
          >
            {CERT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {certType === "Other" && (
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Certification name</label>
            <input
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="e.g. MBE, DBE"
              className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
            />
          </div>
        )}

        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Certification # (optional)</label>
          <input
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
        </div>

        <div>
          <label className="text-label-md text-on-surface-variant block mb-1">Expires (optional)</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary outline-none"
          />
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="text-label-md text-on-surface-variant block mb-1">Certificate document (optional)</label>
          <label className="px-4 py-2 rounded border border-secondary text-secondary text-label-md font-bold hover:bg-surface-container-low transition cursor-pointer inline-block">
            {file ? file.name : "Choose file"}
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-2 px-4 bg-secondary text-on-secondary rounded text-label-md font-semibold hover:bg-on-secondary-container transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 flex items-center gap-2"
        >
          {submitting && <Spinner />}
          {submitting ? "Adding…" : "Add certification"}
        </button>
      </form>

      {error && <p className="text-body-md text-error">{error}</p>}

      {certifications.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No certifications added yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {certifications.map((cert) => (
            <li
              key={cert.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-outline-variant bg-surface flex-wrap"
            >
              <div>
                <p className="text-body-md text-on-surface font-bold">
                  {certLabel(cert)}
                  {cert.certification_number ? ` — #${cert.certification_number}` : ""}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {cert.expiration_date ? `Expires ${new Date(cert.expiration_date).toLocaleDateString()}` : "No expiration on file"}
                  {cert.file_url && (
                    <>
                      {" · "}
                      <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
                        {cert.file_name ?? "View document"}
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${
                    cert.verified
                      ? "bg-secondary-container text-on-secondary-container border-secondary/20"
                      : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {cert.verified ? "Verified" : "Not yet reviewed"}
                </span>
                <button onClick={() => handleRemove(cert.id)} className="text-error text-label-md hover:underline">
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
