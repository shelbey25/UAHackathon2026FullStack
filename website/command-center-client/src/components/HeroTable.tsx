"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import gsap from "gsap";
import { Hero } from "@/hooks/useHeroes";

/* ── time helpers ─────────────────────────────────── */
function timeRemaining(end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── status badge ─────────────────────────────────── */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${
        active
          ? "border-green-800/30 bg-green-950/30 text-green-400"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-[var(--text-muted)]"
        }`}
      />
      {active ? "ON MISSION" : "STANDBY"}
    </span>
  );
}

/* ── progress bar for assignment time ─────────────── */
function TimeProgress({ start, end }: { start: string | null; end: string | null }) {
  if (!start || !end) return null;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const total = e - s;
  if (total <= 0) return null;
  const elapsed = Math.min(now - s, total);
  const pct = Math.round((elapsed / total) * 100);

  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-semibold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
        {pct}%
      </span>
    </div>
  );
}

/* ── main table ───────────────────────────────────── */
interface HeroTableProps {
  heroes: Hero[];
  loading: boolean;
  error: string | null;
  onUnassign: (heroName: string) => void;
  unassigning: string | null;
}

export default function HeroTable({ heroes, loading, error, onUnassign, unassigning }: HeroTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "active" | "standby">("all");

  const filtered = heroes.filter((h) => {
    if (filter === "active") return h.is_active;
    if (filter === "standby") return !h.is_active;
    return true;
  });

  /* ── polished entrance animation ─────────────────── */
  useEffect(() => {
    if (!tableRef.current || loading || filtered.length === 0) return;
    const panel = tableRef.current;
    const accentLine = panel.querySelector(".hero-accent");
    const headerCols = panel.querySelectorAll(".hero-header-col");
    const rows = panel.querySelectorAll(".hero-row");
    const filterBtns = panel.parentElement?.querySelectorAll(".hero-filter-btn");
    const countLabel = panel.parentElement?.querySelector(".hero-count-label");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Filter buttons pop in
    if (filterBtns?.length) {
      tl.fromTo(filterBtns,
        { opacity: 0, scale: 0.85 },
        { opacity: 1, scale: 1, duration: 0.25, stagger: 0.06, ease: "back.out(1.3)" },
        0
      );
    }

    // 2. Count label fades from right
    if (countLabel) {
      tl.fromTo(countLabel,
        { opacity: 0, x: 15 },
        { opacity: 1, x: 0, duration: 0.3 },
        0.1
      );
    }

    // 3. Table panel lifts in
    tl.fromTo(panel,
      { opacity: 0, y: 14, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4 },
      0.15
    );

    // 4. Accent line sweeps from center
    if (accentLine) {
      tl.fromTo(accentLine,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.5, ease: "power2.inOut" },
        0.25
      );
    }

    // 5. Header columns sweep left-to-right
    if (headerCols.length) {
      tl.fromTo(headerCols,
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.25, stagger: 0.04, ease: "power2.out" },
        0.35
      );
    }

    // 6. Cells fade in randomly (shuffled)
    if (rows.length) {
      const allCells: HTMLElement[] = [];
      rows.forEach((row) => {
        row.querySelectorAll(".hero-cell").forEach((c) => allCells.push(c as HTMLElement));
      });

      // Fisher-Yates shuffle
      for (let i = allCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
      }

      gsap.set(rows, { opacity: 1 });
      gsap.set(allCells, { opacity: 0 });

      const baseTime = 0.5;
      const gap = 0.018;
      allCells.forEach((cell, order) => {
        tl.to(cell,
          { opacity: 1, duration: 0.12, ease: "power2.out" },
          baseTime + order * gap
        );
      });
    }

    return () => { tl.kill(); };
  }, [filtered.length, loading, filter]);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded border border-[var(--border)] bg-[var(--surface-1)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-800/30 bg-red-950/20 px-4 py-3 font-mono text-xs text-red-400">
        COMMS ERROR: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2">
        {(["all", "active", "standby"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`hero-filter-btn rounded border px-3 py-1 font-mono text-[10px] font-semibold tracking-widest transition-all ${
              filter === f
                ? f === "active"
                  ? "border-green-800/40 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.15)]"
                  : "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {f === "all" ? "ALL" : f === "active" ? "◉ ON MISSION" : "○ STANDBY"}
          </button>
        ))}
        <span className="hero-count-label ml-auto font-mono text-[9px] tracking-wider text-[var(--text-muted)]">
          {filtered.length} HERO{filtered.length !== 1 ? "ES" : ""}
        </span>
      </div>

      {/* Table */}
      <div ref={tableRef} className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
        {/* Top accent line */}
        <div className="hero-accent absolute inset-x-0 top-0 h-[2px] origin-center bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent z-10" style={{ transform: "scaleX(0)" }} />
        {/* Header */}
        <div className="grid grid-cols-[1fr_0.7fr_0.8fr_1fr_0.8fr_0.8fr_0.6fr] gap-px border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          {["HERO", "STATUS", "RESOURCE", "LOCATION", "TIME LEFT", "PROGRESS", "ACTION"].map((h) => (
            <span key={h} className="hero-header-col font-mono text-[9px] font-semibold tracking-wider text-[var(--text-muted)]">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-xs text-[var(--text-muted)]">
            No heroes found
          </div>
        ) : (
          filtered.map((hero) => (
            <div
              key={hero.hero_name}
              className="hero-row shield-row-interactive grid grid-cols-[1fr_0.7fr_0.8fr_1fr_0.8fr_0.8fr_0.6fr] items-center gap-px border-b border-[var(--border)] px-4 py-3 opacity-0 last:border-b-0"
            >
              {/* Name */}
              <span className="hero-cell font-mono text-xs font-medium text-[var(--text-primary)]">
                {hero.hero_name}
              </span>

              {/* Status */}
              <div className="hero-cell">
                <StatusBadge active={hero.is_active} />
              </div>

              {/* Resource */}
              <span className="hero-cell font-mono text-[11px] text-[var(--text-secondary)]">
                {hero.is_active ? hero.active_resource : "—"}
              </span>

              {/* Location */}
              <span className="hero-cell font-mono text-[11px] text-[var(--text-secondary)]">
                {hero.is_active ? hero.active_location : "—"}
              </span>

              {/* Time remaining */}
              <span className={`hero-cell font-mono text-[11px] ${
                hero.is_active && hero.assignment_end_time && new Date(hero.assignment_end_time).getTime() - Date.now() < 3_600_000
                  ? "text-yellow-400"
                  : "text-[var(--text-secondary)]"
              }`}>
                {hero.is_active ? timeRemaining(hero.assignment_end_time) : "—"}
              </span>

              {/* Progress */}
              <div className="hero-cell min-w-0 overflow-hidden pr-3">
                {hero.is_active ? (
                  <TimeProgress start={hero.assignment_start_time} end={hero.assignment_end_time} />
                ) : (
                  <span className="font-mono text-[9px] text-[var(--text-muted)]">—</span>
                )}
              </div>

              {/* Action */}
              <div className="hero-cell">
                {hero.is_active && (
                  <button
                    onClick={() => onUnassign(hero.hero_name)}
                    disabled={unassigning === hero.hero_name}
                    className="rounded border border-red-800/30 bg-red-950/20 px-2 py-1 font-mono text-[9px] font-semibold tracking-wider text-red-400 transition-all hover:border-red-700/50 hover:bg-red-950/40 hover:shadow-[0_0_8px_rgba(239,68,68,0.15)] disabled:opacity-40"
                  >
                    {unassigning === hero.hero_name ? "…" : "RECALL"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
