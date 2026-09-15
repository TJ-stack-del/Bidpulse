"use client";

import { useState } from "react";

// Same button/error-state convention as PacketButtons.tsx's "Download
// packet" -- a bare secondary-style button, disabled while in flight, with
// the error (if any) as plain text beneath it rather than a toast/modal.
// The zip itself is built server-side (app/api/compliance/export/route.ts,
// scoped to the requesting user's own client_id) -- this component only
// fetches it and hands the browser a real file to save.
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
        className="self-start flex items-center gap-2 px-4 py-2 rounded border border-primary text-primary text-label-md font-bold hover:bg-surface-container-low transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[18px]">folder_zip</span>
        {downloading ? "Building…" : "Export Full Vault (.zip)"}
      </button>
      {error && <p className="text-body-md text-error">{error}</p>}
    </div>
  );
}
