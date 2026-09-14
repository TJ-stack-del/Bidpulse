"use client";

import { useRef, useState } from "react";
import { Spinner } from "./Spinner";

export type ExtractedCompanyProfile = {
  companyName: string | null;
  contactName: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  yearsInBusiness: number | null;
  naicsCodes: string[];
  naicsOther: string | null;
  licenseNumber: string | null;
  businessRegistrationNumber: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  generalLiabilityCoverage: string | null;
  workersCompCoverage: string | null;
  commercialAutoCoverage: string | null;
  certifications: {
    recordType: "trade_license" | "small_business_cert" | "field_certification";
    // For recordType "small_business_cert" this is one of the fixed program
    // values (8(a), WOSB, ...); for "trade_license"/"field_certification"
    // it's the license/certification's actual name as stated in the
    // document (e.g. "Master Electrician License") -- see
    // app/api/extract-company-profile/route.ts for why this can't be a
    // fixed enum for those two record types.
    certType: string;
    otherLabel: string | null;
    certificationNumber: string | null;
    jurisdictionState: string | null;
    licensingBoard: string | null;
    expirationDate: string | null;
  }[];
};

// Shared by the Company Profile page and the intake wizard's "About you"
// step — same extraction call, same upload affordance, so a client can fill
// in their profile from an existing document instead of retyping everything
// on either surface.
export function CompanyProfileUpload({
  onExtracted,
}: {
  onExtracted: (data: ExtractedCompanyProfile, file: File) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-company-profile", { method: "POST", body: formData });

      // A killed serverless function (e.g. a slow extraction call outrunning
      // the platform's execution limit) returns a platform error page, not
      // JSON — distinguishing that from a real server-returned error means
      // a genuine timeout doesn't get reported as the same vague message as
      // "this file has no readable text."
      let data: { error?: string };
      try {
        data = await res.json();
      } catch {
        setError(
          res.status === 504
            ? "That document took too long to process. Try a smaller or simpler file."
            : `Something went wrong reading that document (server error ${res.status}). Try again in a moment.`
        );
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Couldn't read that document.");
        return;
      }

      onExtracted(data as ExtractedCompanyProfile, file);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !uploading) handleFile(file);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 text-center transition cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
          isDragging
            ? "border-primary bg-primary-container/40"
            : "border-primary/40 bg-surface-container-low hover:border-primary/70 hover:bg-surface-container"
        } ${uploading ? "opacity-70 pointer-events-none" : ""}`}
      >
        {uploading ? (
          <Spinner />
        ) : (
          <span className="material-symbols-outlined text-primary text-[32px]">upload_file</span>
        )}
        <span className="text-label-md font-bold text-on-surface">
          {uploading ? "Reading document…" : "Upload a document to autofill"}
        </span>
        {!uploading && (
          <p className="text-body-sm text-on-surface-variant max-w-sm">
            Drag and drop a capability statement, license packet, or insurance certificates here, or
            click to browse. We&apos;ll fill in what we can find below.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          disabled={uploading}
          className="sr-only"
        />
      </label>
      {error && <p className="text-body-md text-error">{error}</p>}
    </div>
  );
}
