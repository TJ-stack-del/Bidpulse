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
    certType: "8(a)" | "WOSB" | "EDWOSB" | "HUBZone" | "SDVOSB" | "VOSB" | "Other";
    otherLabel: string | null;
    certificationNumber: string | null;
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
            ? "That document took too long to process — try a smaller or simpler file."
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
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex flex-col gap-2">
      <p className="text-body-md text-on-surface">
        Have a capability statement, license packet, or insurance certificates handy? Upload it and
        we&apos;ll fill in what we can find below — review it before saving.
      </p>
      <div className="flex items-center gap-3">
        <label className="py-2 px-4 border border-outline-variant rounded text-label-md text-on-surface hover:bg-surface-container transition active:scale-[0.97] cursor-pointer w-fit flex items-center gap-2">
          {uploading && <Spinner />}
          {uploading ? "Reading document…" : "Upload a document"}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-body-md text-error">{error}</p>}
    </div>
  );
}
