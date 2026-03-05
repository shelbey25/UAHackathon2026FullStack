"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { InventoryRecord } from "@/hooks/useInventory";

interface InventoryTableProps {
  records: InventoryRecord[];
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
}

export default function InventoryTable({
  records,
  loading,
  error,
  onRefetch,
}: InventoryTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && records.length > 0 && tableRef.current) {
      const panel = tableRef.current;
      const headers = panel.querySelectorAll("thead th");
      const rows = panel.querySelectorAll("tbody tr");

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1. Panel slides up
      tl.fromTo(panel, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }, 0);

      // 2. Header columns stagger
      if (headers.length) {
        tl.fromTo(headers,
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.2, stagger: 0.04 },
          0.2
        );
      }

      // 3. Rows stagger in one by one
      if (rows.length) {
        tl.fromTo(rows,
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, duration: 0.2, stagger: 0.03 },
          0.35
        );
      }

      return () => { tl.kill(); };
    }
  }, [loading, records]);

  if (loading) {
    return (
      <div className="shield-panel flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--surface-3)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="shield-panel border-red-900/40 p-6 text-center">
        <p className="font-mono text-xs tracking-wider text-red-400">{error}</p>
        <button
          onClick={onRefetch}
          className="mt-3 font-mono text-xs tracking-wider text-[var(--accent)] hover:text-[var(--text-primary)]"
        >
          RETRY
        </button>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="shield-panel p-12 text-center">
        <p className="font-mono text-xs tracking-wider text-[var(--text-muted)]">NO INVENTORY RECORDS FOUND</p>
      </div>
    );
  }

  return (
    <div ref={tableRef} className="overflow-x-auto shield-panel">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]/60">
          <tr>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">SECTOR</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCE</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] text-right">STOCK LEVEL</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] text-right">USAGE/HR</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] text-center">SNAP</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESTOCK REASON</th>
            <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">TIMESTAMP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {records.map((r) => (
            <tr
              key={r.id}
              className={`shield-row-interactive transition-colors ${
                r.restock_reason
                  ? "bg-green-950/5 border-l-2 border-l-green-600"
                  : ""
              }`}
            >
              <td className="px-4 py-3 text-[var(--text-primary)]">{r.sector_id}</td>
              <td className="px-4 py-3 text-[var(--text-primary)]">{r.resource_type}</td>
              <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono tabular-nums">
                {r.stock_level?.toLocaleString() ?? "—"}
              </td>
              <td className="px-4 py-3 text-[var(--text-primary)] text-right font-mono tabular-nums">
                {r.usage_rate_hourly?.toLocaleString() ?? "—"}
              </td>
              <td className="px-4 py-3 text-center">
                {r.snap_event_detected ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" title="Snap event detected" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--surface-3)]" />
                )}
              </td>
              <td className="px-4 py-3">
                {r.restock_reason ? (
                  <span className="inline-flex items-center gap-1.5 rounded border border-green-800/30 bg-green-950/30 px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-green-400">
                    📦 {r.restock_reason}
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                {new Date(r.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
