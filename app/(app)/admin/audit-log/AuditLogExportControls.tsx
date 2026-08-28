"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateSha256,
  generateCsv,
  generateJson,
  triggerDownload,
  type AuditLogRow,
} from "@/lib/audit/export";

export function AuditLogExportControls({ logs }: { logs: AuditLogRow[] }) {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [manifestHash, setManifestHash] = useState<string>("");

  const eventTypes = useMemo(
    () => ["ALL", ...Array.from(new Set(logs.map((l) => l.event_type)))],
    [logs]
  );

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (eventTypeFilter !== "ALL" && l.event_type !== eventTypeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${l.event_type} ${l.actor_name ?? ""} ${JSON.stringify(
          l.event_detail ?? {}
        )}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, eventTypeFilter, search]);

  // Recompute the SHA-256 manifest hash whenever the filtered scope changes —
  // this is what makes the export tamper-evident: the hash covers exactly
  // the record set that was exported.
  useEffect(() => {
    let cancelled = false;
    calculateSha256(JSON.stringify(filtered)).then((hash) => {
      if (!cancelled) setManifestHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [filtered]);

  function handleExport(format: "csv" | "json") {
    const content =
      format === "csv" ? generateCsv(filtered, manifestHash) : generateJson(filtered, manifestHash);
    const mimeType = format === "csv" ? "text/csv" : "application/json";
    triggerDownload(content, `bidpulse-audit-log-${Date.now()}.${format}`, mimeType);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-3">
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface"
        >
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search actor, event type, detail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface text-body-md text-on-surface"
        />
      </div>

      <div className="bg-surface p-4 rounded border border-secondary/30">
        <p className="text-label-md text-on-surface-variant mb-1">
          SHA-256 manifest for this scope ({filtered.length} record{filtered.length === 1 ? "" : "s"})
        </p>
        <p className="font-code text-code-sm text-on-surface break-all">
          {manifestHash || "calculating…"}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleExport("csv")}
          className="px-4 py-2 bg-primary text-on-primary rounded text-label-md hover:bg-on-background transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={() => handleExport("json")}
          className="px-4 py-2 bg-surface text-secondary border border-secondary rounded text-label-md hover:bg-surface-container-low transition-colors"
        >
          Export JSON
        </button>
      </div>

      <div className="overflow-x-auto border border-outline-variant rounded-lg">
        <table className="w-full text-body-md">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="text-left px-3 py-2 text-label-md text-on-surface-variant">Timestamp</th>
              <th className="text-left px-3 py-2 text-label-md text-on-surface-variant">Actor</th>
              <th className="text-left px-3 py-2 text-label-md text-on-surface-variant">Event</th>
              <th className="text-left px-3 py-2 text-label-md text-on-surface-variant">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="border-t border-outline-variant even:bg-surface-container-low/40">
                <td className="px-3 py-2 text-on-surface-variant">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-on-surface">{log.actor_name ?? "—"}</td>
                <td className="px-3 py-2 text-on-surface">{log.event_type}</td>
                <td className="px-3 py-2 text-on-surface-variant font-code text-code-sm">
                  {JSON.stringify(log.event_detail ?? {})}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-on-surface-variant">
                  No matching audit log entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
