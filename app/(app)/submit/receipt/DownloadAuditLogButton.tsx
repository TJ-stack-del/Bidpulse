"use client";

import { useState } from "react";
import { calculateSha256, generateCsv, triggerDownload, type AuditLogRow } from "@/lib/audit/export";

export function DownloadAuditLogButton({ logs, bidId }: { logs: AuditLogRow[]; bidId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    const manifestHash = await calculateSha256(JSON.stringify(logs));
    const csv = generateCsv(logs, manifestHash);
    triggerDownload(csv, `bidpulse-audit-log-${bidId}.csv`, "text/csv");
    setDownloading(false);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="w-full bg-primary-container text-on-primary text-label-md py-3 px-4 flex items-center justify-center gap-2 hover:bg-on-background transition-colors border border-transparent rounded disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-[18px]">download</span>
      {downloading ? "Preparing…" : "Download Full Audit Log"}
    </button>
  );
}
