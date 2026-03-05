"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useAuth } from "@clerk/nextjs";
import { RawReport, Priority } from "@/hooks/useReports";
import { API_BASE_URL } from "@/lib/api";

/* ── typewriter hook for intel summary ────────────── */
function useTypewriter(text: string, speed = 18, startDelay = 900) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setStarted(false);
    const delayTimer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(delayTimer);
  }, [text, startDelay]);

  useEffect(() => {
    if (!started || !text) return;
    let i = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, started]);

  return { displayed, done: displayed.length >= text.length };
}

const PAGE_SIZE = 20;

/* ── priority badge colours (S.H.I.E.L.D.) ───────── */
const PRIORITY_STYLES: Record<Priority, string> = {
  ROUTINE:
    "bg-green-950/30 text-green-400 border-green-800/30",
  HIGH:
    "bg-yellow-950/30 text-yellow-400 border-yellow-800/30",
  URGENT:
    "bg-yellow-950/30 text-yellow-400 border-yellow-800/30",
  CRITICAL:
    "bg-red-950/30 text-red-400 border-red-800/30",
  AVENGERS_LEVEL_THREAT:
    "bg-red-950/30 text-red-400 border-red-800/30",
};

/* ── short display labels ─────────────────────────── */
const PRIORITY_LABEL: Record<Priority, string> = {
  ROUTINE: "ROUTINE",
  HIGH: "HIGH",
  URGENT: "URGENT",
  CRITICAL: "CRITICAL",
  AVENGERS_LEVEL_THREAT: "AVENGERS",
};

/* ── detail modal (portalled to document.body) ────── */
function ReportDetailModal({
  report,
  onClose,
}: {
  report: RawReport;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const p = report.ProcessedReport;
  const isProcessed = !!p;
  const displayPriority = p?.priority ?? report.priority;

  /* typewriter for intel summary */
  const summaryText = isProcessed ? report.rawText : "";
  const { displayed: typedSummary, done: typingDone } = useTypewriter(summaryText, 18, 900);

  /* copy report ID to clipboard */
  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(report.report_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  }, [report.report_id]);

  /* blur the entire page behind the modal */
  useEffect(() => {
    const root = document.getElementById("__next") ?? document.body.firstElementChild;
    if (root instanceof HTMLElement) {
      root.style.filter = "blur(4px)";
      root.style.transition = "filter 0.2s ease";
    }
    return () => {
      if (root instanceof HTMLElement) {
        root.style.filter = "";
      }
    };
  }, []);

  /* animate in — heavy sequential */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Overlay fades
    if (overlayRef.current) {
      tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
    }

    // 2. Panel slides + scales
    if (panelRef.current) {
      tl.fromTo(panelRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35 },
        0.1
      );

      // 3. Accent line on panel
      const accentLine = panelRef.current.querySelector(".modal-accent") as HTMLElement;
      if (accentLine) {
        tl.fromTo(accentLine, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 0.25);
      }

      // 4. Header badges stagger
      const badges = panelRef.current.querySelectorAll(".modal-header-badge");
      if (badges.length) {
        tl.fromTo(badges,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.2, stagger: 0.06 },
          0.35
        );
      }

      // 5. Grid items stagger
      const gridItems = panelRef.current.querySelectorAll(".modal-grid-item");
      if (gridItems.length) {
        tl.fromTo(gridItems,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.2, stagger: 0.05 },
          0.5
        );
      }

      // 6. Summary textbox
      const summary = panelRef.current.querySelector(".modal-summary") as HTMLElement;
      if (summary) {
        tl.fromTo(summary,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3 },
          0.75
        );
      }
    }

    return () => { tl.kill(); };
  }, []);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* prevent body scroll while modal is open */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (typeof window === "undefined") return null;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative mx-4 w-full max-w-2xl rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-glow)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="modal-accent absolute inset-x-0 top-0 h-[2px] origin-center rounded-t-lg bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ transform: "scaleX(0)" }} />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-5">
          {/* Badges row */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyId}
              className="modal-header-badge inline-flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)] active:scale-95"
              title={report.report_id}
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  <span className="text-green-400">COPIED</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                  COPY ID
                </>
              )}
            </button>
            <span
              className={`modal-header-badge inline-flex items-center rounded border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider ${PRIORITY_STYLES[displayPriority]}`}
            >
              {PRIORITY_LABEL[displayPriority] ?? displayPriority}
            </span>
            {isProcessed ? (
              p!.cleared ? (
                <span className="modal-header-badge inline-flex items-center gap-1 rounded border border-green-800/30 bg-green-950/30 px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-green-400">
                  ARCHIVE
                </span>
              ) : (
                <span className="modal-header-badge inline-flex items-center gap-1 rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[var(--accent)]">
                  ACTIVE
                </span>
              )
            ) : (
              <span className="modal-header-badge inline-flex items-center gap-1 rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[var(--accent)]">
                ACTIVE
              </span>
            )}
          </div>

          {/* Hero status headline */}
          {isProcessed && (
            <h2 className="modal-header-badge mt-4 text-base font-semibold tracking-wide text-[var(--text-primary)]">
              <span className="text-[var(--accent)]">{report.heroAlias ?? "Unknown"}</span>
              {" is reporting "}
              <span className={`font-bold ${
                p!.resource_level === "CRITICAL" ? "text-red-400" :
                p!.resource_level === "LOW" ? "text-yellow-400" :
                "text-[var(--accent)]"
              }`}>{p!.resource_level || "UNKNOWN"}</span>
              {" resource status at "}
              <span className="text-[var(--text-primary)]">{p!.location}</span>
            </h2>
          )}
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="modal-grid-item">
              <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">HERO</span>
              <span className="text-[var(--text-primary)]">{report.heroAlias ?? "—"}</span>
            </div>
            <div className="modal-grid-item">
              <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RECEIVED</span>
              <span className="text-[var(--text-primary)]">{new Date(report.receivedAt).toLocaleString()}</span>
            </div>
            <div className="modal-grid-item">
              <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">LOCATION</span>
              <span className="text-[var(--text-primary)]">
                {isProcessed ? p!.location : <span className="italic text-[var(--text-muted)]">Processing…</span>}
              </span>
            </div>
            <div className="modal-grid-item">
              <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCE</span>
              <span className="text-[var(--text-primary)]">
                {isProcessed ? p!.resource_name : <span className="italic text-[var(--text-muted)]">Processing…</span>}
              </span>
            </div>
            <div className="modal-grid-item">
              <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCE LEVEL</span>
              <span className="text-[var(--text-primary)]">
                {isProcessed ? (p!.resource_level || "—") : <span className="italic text-[var(--text-muted)]">Processing…</span>}
              </span>
            </div>
            {isProcessed && (
              <div className="modal-grid-item">
                <span className="block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">PROCESSED AT</span>
                <span className="text-[var(--text-primary)]">{new Date(p!.processedAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Summary / redacted text — typewriter effect */}
          <div className="modal-summary">
            <span className="mb-1.5 block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">INTEL SUMMARY</span>
            {isProcessed ? (
              <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-4 font-mono text-sm leading-relaxed text-green-400/90">
                {/* scanline overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.06)_2px,rgba(0,0,0,0.06)_4px)]" />
                <span className="whitespace-pre-wrap">
                  {typedSummary}
                </span>
                {!typingDone && (
                  <span className="inline-block w-[2px] h-[1em] ml-[1px] align-middle bg-green-400 animate-pulse" />
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--border)] p-4 font-mono text-xs italic text-[var(--text-muted)]">
                Processing…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}

/* ── component ────────────────────────────────────── */
interface ReportsTableProps {
  reports: RawReport[];
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
}

export default function ReportsTable({
  reports,
  loading,
  error,
  onRefetch,
}: ReportsTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedReport, setSelectedReport] = useState<RawReport | null>(null);
  const [page, setPage] = useState(1);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const { getToken } = useAuth();

  const handleArchive = useCallback(async (reportId: string) => {
    setArchivingId(reportId);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/reports/${reportId}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Archive failed: ${res.status}`);
      onRefetch();
    } catch (err) {
      console.error("Archive error:", err);
    } finally {
      setArchivingId(null);
    }
  }, [getToken, onRefetch]);

  /* Reset to page 1 when the filtered dataset changes */
  useEffect(() => { setPage(1); }, [reports.length]);

  /* ── client-side pagination ─────────────────────── */
  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => reports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [reports, safePage],
  );

  /* ── animate in ──────────────────────────────────── */
  useEffect(() => {
    if (!loading && reports.length > 0 && tableRef.current) {
      const panel = tableRef.current;
      const infoBar = panel.querySelector(".rpt-info-bar");
      const tablePanel = panel.querySelector(".rpt-table-panel");
      const accentLine = panel.querySelector(".rpt-accent");
      const headers = panel.querySelectorAll("thead th");
      const rows = panel.querySelectorAll("tbody tr");
      const pagBtns = panel.querySelectorAll(".shield-pag-btn");

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1. Info bar fades in from right
      if (infoBar) {
        tl.fromTo(infoBar,
          { opacity: 0, x: 20 },
          { opacity: 1, x: 0, duration: 0.35 },
          0
        );
      }

      // 2. Table panel scales up from subtle origin
      if (tablePanel) {
        tl.fromTo(tablePanel,
          { opacity: 0, y: 16, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.45 },
          0.1
        );
      }

      // 3. Accent line sweeps from center
      if (accentLine) {
        tl.fromTo(accentLine,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.5, ease: "power2.inOut" },
          0.2
        );
      }

      // 4. Header columns sweep in left-to-right
      if (headers.length) {
        tl.fromTo(headers,
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.25, stagger: 0.04, ease: "power2.out" },
          0.3
        );
      }

      // 5. Rows fade in one by one in order
      if (rows.length) {
        gsap.set(rows, { opacity: 0, y: 6 });

        const baseTime = 0.5;
        const gap = 0.04;
        rows.forEach((row, i) => {
          tl.to(row,
            { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" },
            baseTime + i * gap
          );
        });
      }

      // 6. Pagination buttons pop in with bounce
      if (pagBtns.length) {
        tl.fromTo(pagBtns,
          { opacity: 0, scale: 0.7, y: 6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.25, stagger: 0.04, ease: "back.out(1.4)" },
          "-=0.15"
        );
      }

      return () => { tl.kill(); };
    }
  }, [loading, reports, safePage]);

  /* ── loading / error / empty states ──────────────── */
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

  if (reports.length === 0) {
    return (
      <div className="shield-panel p-12 text-center">
        <p className="font-mono text-xs tracking-wider text-[var(--text-muted)]">NO REPORTS FOUND</p>
      </div>
    );
  }

  return (
    <div ref={tableRef}>
      {/* ── Detail modal ───────────────────────────── */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* ── Info bar ────────────────────────────────── */}
      <div className="rpt-info-bar mb-4 flex items-center">
        <span className="ml-auto font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
          {reports.length} REPORT{reports.length !== 1 ? "S" : ""}
          {" · PAGE "}{safePage} OF {totalPages}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────── */}
      <div className="rpt-table-panel relative overflow-x-auto shield-panel">
        {/* Top accent line */}
        <div className="rpt-accent absolute inset-x-0 top-0 h-[2px] origin-center bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ transform: "scaleX(0)" }} />
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]/60">
            <tr>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">HERO</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">PRIORITY</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">LOCATION</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCE</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCE LEVEL</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] text-center">STATUS</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">RECEIVED</th>
              <th className="px-4 py-3 font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)] text-center">ACTION</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {paged.map((r) => {
              const p = r.ProcessedReport;
              const isProcessed = !!p;
              const displayPriority = p?.priority ?? r.priority;

              return (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`shield-row-interactive cursor-pointer ${
                    !isProcessed ? "opacity-60" : ""
                  }`}
                >
                  {/* Hero alias */}
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.heroAlias ?? <span className="text-[var(--text-muted)]">—</span>}
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider ${PRIORITY_STYLES[displayPriority]}`}
                    >
                      {PRIORITY_LABEL[displayPriority] ?? displayPriority}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {isProcessed ? (
                      p.location
                    ) : (
                      <span className="italic text-[var(--text-muted)]">Processing…</span>
                    )}
                  </td>

                  {/* Resource name */}
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {isProcessed ? (
                      p.resource_name
                    ) : (
                      <span className="italic text-[var(--text-muted)]">Processing…</span>
                    )}
                  </td>

                  {/* Resource Level */}
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {isProcessed ? (
                      p.resource_level || "—"
                    ) : (
                      <span className="italic text-[var(--text-muted)]">Processing…</span>
                    )}
                  </td>

                  {/* Status (Active / Archive) */}
                  <td className="px-4 py-3 text-center">
                    {isProcessed && p.cleared ? (
                      <span className="inline-flex items-center rounded border border-green-800/30 bg-green-950/30 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-green-400">
                        ARCHIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[var(--accent)]">
                        ACTIVE
                      </span>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {new Date(r.receivedAt).toLocaleString()}
                  </td>

                  {/* Archive action */}
                  <td className="px-4 py-3 text-center">
                    {isProcessed && !p.cleared ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(r.report_id); }}
                        disabled={archivingId === r.report_id}
                        className="rounded border border-green-800/30 bg-green-950/30 px-2.5 py-1 font-mono text-[10px] font-medium tracking-wider text-green-400 transition-all hover:border-green-600/50 hover:bg-green-900/40 hover:shadow-[0_0_8px_rgba(34,197,94,0.2)] disabled:opacity-40"
                      >
                        {archivingId === r.report_id ? "ARCHIVING…" : "ARCHIVE"}
                      </button>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center font-mono text-xs tracking-wider text-[var(--text-muted)]">
                  NO REPORTS MATCH THE SELECTED FILTERS
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination controls ────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={safePage <= 1}
            onClick={() => setPage(1)}
            className="shield-pag-btn rounded border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
          >
            ««
          </button>
          <button
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="shield-pag-btn rounded border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
          >
            ‹ PREV
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "…" ? (
                <span key={`ellipsis-${idx}`} className="px-1 font-mono text-[10px] text-[var(--text-muted)]">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className={`shield-pag-btn rounded border px-2.5 py-1.5 font-mono text-[10px] font-medium tracking-wider transition-all ${
                    item === safePage
                      ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                      : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}

          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="shield-pag-btn rounded border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
          >
            NEXT ›
          </button>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage(totalPages)}
            className="shield-pag-btn rounded border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)] disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
          >
            »»
          </button>
        </div>
      )}
    </div>
  );
}
