"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Filled/primary treatment (same as PacketButtons.tsx's "Download packet"),
// not the outline "Preview packet" one -- review found the outline style
// undersold what's arguably the single most useful action on this page.
// Real <Spinner /> instead of a bare text swap, matching this app's own
// convention for async buttons (CertificationsSection's "Add
// certification"/"Remove") -- the underlying route fetches and re-zips
// files serially with a 60s budget, so this can run for several real
// seconds, not the near-instant single-row writes those other buttons
// cover.
//
// Rendering is gated by the caller (app/dashboard/compliance/page.tsx only
// mounts this once there's at least one exportable document) rather than
// this component disabling itself -- a brand-new client with nothing
// verified yet and an empty document library never sees a button whose
// first click is guaranteed to 404.
export function ExportVaultButton() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/export");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Couldn't build the export.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "compliance-vault.zip";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the export.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={downloading}
        className="self-start flex items-center gap-2 px-4 py-2 rounded bg-primary-container text-on-primary-container text-label-md font-bold hover:opacity-90 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {downloading ? <Spinner /> : <span className="material-symbols-outlined text-[18px]">folder_zip</span>}
        {downloading ? "Building…" : "Export Full Vault (.zip)"}
      </button>
      {error && <p className="text-body-md text-error">{error}</p>}
    </div>
  );
}
