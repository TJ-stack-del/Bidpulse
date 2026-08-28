// Adapted from the AI Studio prototype's cryptoUtils.ts — the SHA-256
// manifest + CSV/JSON export idea was worth keeping, but this version
// works on real audit_log rows (see schema.sql) instead of fake data.

export type AuditLogRow = {
  id: string;
  bid_id: string | null;
  event_type: string;
  event_detail: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null; // joined from team_members, not a raw column
};

export async function calculateSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateCsv(rows: AuditLogRow[], manifestHash: string): string {
  const headers = ["Timestamp (UTC)", "Actor", "Event Type", "Bid ID", "Detail"];
  const csvRows = rows.map((r) => [
    `"${r.created_at}"`,
    `"${r.actor_name ?? "unknown"}"`,
    `"${r.event_type}"`,
    `"${r.bid_id ?? ""}"`,
    `"${JSON.stringify(r.event_detail ?? {}).replace(/"/g, '""')}"`,
  ]);
  const manifestHeader = `# BidPulse Audit Log Export\n# SHA-256 Manifest: ${manifestHash}\n# Generated: ${new Date().toISOString()}\n# Record Count: ${rows.length}\n`;
  return manifestHeader + [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
}

export function generateJson(rows: AuditLogRow[], manifestHash: string): string {
  return JSON.stringify(
    {
      metadata: {
        system: "BidPulse Audit Log",
        exportedAtUtc: new Date().toISOString(),
        recordCount: rows.length,
        sha256Manifest: manifestHash,
      },
      records: rows,
    },
    null,
    2
  );
}

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
