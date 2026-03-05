"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import gsap from "gsap";
import { useLockdown } from "@/hooks/useLockdown";
import { useSyncUser } from "@/hooks/useSyncUser";
import LockdownOverlay from "@/components/LockdownOverlay";
import { useInventory } from "@/hooks/useInventory";
import { useReports } from "@/hooks/useReports";
import { useForecast } from "@/hooks/useForecast";
import InventoryChart from "@/components/InventoryChart";
import ReportsTable from "@/components/ReportsTable";
import SubmitReportModal from "@/components/SubmitReportModal";
import EarthMap from "@/components/EarthMap";
import HeroTable from "@/components/HeroTable";
import AssignHeroModal from "@/components/AssignHeroModal";
import JarvisPanel from "@/components/JarvisPanel";
import { useHeroes } from "@/hooks/useHeroes";
import { useJarvisSync } from "@/hooks/useJarvisSync";

/* ── known filter values ──────────────────────────── */
const ALL_SECTORS = [
  "Avengers Compound",
  "New Asgard",
  "Sanctum Sanctorum",
  "Sokovia",
  "Wakanda",
];

const ALL_RESOURCES = [
  "Arc Reactor Cores",
  "Clean Water (L)",
  "Medical Kits",
  "Pym Particles",
  "Vibranium (kg)",
];

/* ── toggle pill component ────────────────────────── */
function TogglePill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`shield-pill rounded border px-3 py-1 font-mono text-xs font-medium tracking-wider ${
        active
          ? "shield-pill-active border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </button>
  );
}

/* ── top-level tab type ───────────────────────────── */
type Tab = "overview" | "graph" | "reports" | "heroes";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "graph", label: "Graph" },
  { key: "reports", label: "Reports" },
  { key: "heroes", label: "Heroes" },
];

export default function DashboardPage() {
  const headerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shieldIconRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const accentLineRef = useRef<HTMLDivElement>(null);

  const { locked } = useLockdown();
  useSyncUser();

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedSector, setSelectedSector] = useState<string>(ALL_SECTORS[0]);
  const [selectedResource, setSelectedResource] = useState<string>(ALL_RESOURCES[0]);
  const [days, setDays] = useState(60);

  /* ── Submit report modal ─────────────────────── */
  const [submitReportOpen, setSubmitReportOpen] = useState(false);

  /* ── Report filter state ──────────────────────── */
  const [reportMailbox, setReportMailbox] = useState<"active" | "archive">("active");
  const [rptLocation, setRptLocation] = useState<string>("ALL");
  const [rptResource, setRptResource] = useState<string>("ALL");
  const [rptHero, setRptHero] = useState<string>("ALL");
  const [rptPriority, setRptPriority] = useState<string>("ALL");
  const [rptLevel, setRptLevel] = useState<string>("ALL");

  /* Fetch ALL data (no sector/resource param) — filter client-side */
  const { records: rawRecords, loading, error, refetch } = useInventory({ days });

  /* ── J.A.R.V.I.S. ───────────────────────────── */
  const { sync: jarvisSync, loading: jarvisLoading, instructions: jarvisInstructions, error: jarvisError, reset: jarvisReset } = useJarvisSync();
  const [jarvisOpen, setJarvisOpen] = useState(false);

  /* ── Heroes ──────────────────────────────────── */
  const { heroes, loading: heroesLoading, error: heroesError, refetch: refetchHeroes, assignHero, unassignHero } = useHeroes();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  /* Fetch reports (server filters: priority + cleared; fetch all, paginate client-side) */
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useReports({
    page: 1,
    limit: 10000,
    priority: rptPriority !== "ALL" ? rptPriority : undefined,
    cleared: reportMailbox === "archive" ? true : null,
  });

  /* ── Hardcoded report filter options ───────────── */
  const ALL_HEROES = [
    "Bruce Banner",
    "Natasha Romanoff",
    "Peter Parker",
    "Steve Rogers",
    "Thor Odinson",
    "Tony Stark",
  ];
  const ALL_PRIORITIES = [
    { value: "AVENGERS_LEVEL_THREAT", label: "AVENGERS" },
    { value: "HIGH", label: "HIGH" },
    { value: "ROUTINE", label: "ROUTINE" },
  ];
  const ALL_RESOURCE_LEVELS = ["CRITICAL", "LOW", "MODERATE", "STABLE"];

  /* Fetch forecast slopes */
  const { forecasts, refetch: refetchForecasts } = useForecast();

  /* Find the depletionRate for the active sector+resource combo */
  const depletionRate = useMemo(() => {
    const match = forecasts.find(
      (f) => f.location === selectedSector && f.resource === selectedResource
    );
    return match?.depletionRate ?? null;
  }, [forecasts, selectedSector, selectedResource]);

  /* ── Filtered reports (client-side for location/resource/hero/level + active) ── */
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const p = r.ProcessedReport;
      /* Active: hide cleared reports (server can't filter cleared=false) */
      if (reportMailbox === "active" && p?.cleared) return false;
      /* Location */
      if (rptLocation !== "ALL" && (p?.location ?? "") !== rptLocation) return false;
      /* Resource */
      if (rptResource !== "ALL" && (p?.resource_name ?? "") !== rptResource) return false;
      /* Hero */
      if (rptHero !== "ALL" && (r.heroAlias ?? "") !== rptHero) return false;
      /* Resource Level */
      if (rptLevel !== "ALL" && (p?.resource_level ?? "") !== rptLevel) return false;
      return true;
    });
  }, [reports, reportMailbox, rptLocation, rptResource, rptHero, rptLevel]);

  /* Client-side filter by selected toggles */
  const records = useMemo(
    () =>
      rawRecords.filter(
        (r) =>
          r.sector_id === selectedSector &&
          r.resource_type === selectedResource
      ),
    [rawRecords, selectedSector, selectedResource]
  );

  /* ═══ HEAVY SEQUENTIAL ENTRANCE ANIMATION ═══════ */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Top accent line sweeps in from center
    tl.fromTo(accentLineRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.5, ease: "power2.inOut" },
      0
    );

    // 2. Header slides down
    tl.fromTo(headerRef.current,
      { opacity: 0, y: -30 },
      { opacity: 1, y: 0, duration: 0.5 },
      0.15
    );

    // 3. Shield icon pops with scale
    tl.fromTo(shieldIconRef.current,
      { opacity: 0, scale: 0.5, rotate: -10 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.4, ease: "back.out(1.7)" },
      0.4
    );

    // 4. Brand text types in
    tl.fromTo(brandRef.current,
      { opacity: 0, x: -10 },
      { opacity: 1, x: 0, duration: 0.35 },
      0.55
    );

    // 5. Status text fades
    tl.fromTo(statusRef.current,
      { opacity: 0, x: 10 },
      { opacity: 1, x: 0, duration: 0.3 },
      0.7
    );

    // 6. Nav bar slides in
    tl.fromTo(navRef.current,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.35 },
      0.8
    );

    // 7. Nav tab buttons stagger
    if (navRef.current) {
      const buttons = navRef.current.querySelectorAll("button");
      tl.fromTo(buttons,
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.08 },
        0.9
      );
    }

    // 8. Main content lifts in
    tl.fromTo(contentRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5 },
      1.1
    );

    return () => { tl.kill(); };
  }, []);

  /* ═══ TAB CHANGE ANIMATION ══════════════════════ */
  const handleTabChange = useCallback((newTab: Tab) => {
    if (newTab === tab || !contentRef.current) {
      setTab(newTab);
      return;
    }

    // Quick exit, then enter
    const tl = gsap.timeline();
    tl.to(contentRef.current, {
      opacity: 0, y: 12, duration: 0.15, ease: "power2.in",
      onComplete: () => setTab(newTab),
    });
    tl.fromTo(contentRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" },
      "+=0.05"
    );
  }, [tab]);

  /* ═══ REPORTS TAB ENTRANCE ANIMATION ═══════════════ */
  useEffect(() => {
    if (tab !== "reports" || !contentRef.current) return;

    const header = contentRef.current.querySelector(".rpt-header");
    const actions = contentRef.current.querySelector(".rpt-header-actions");
    const mailbox = contentRef.current.querySelector(".rpt-mailbox");
    const mailboxBtns = mailbox?.querySelectorAll("button");
    const filters = contentRef.current.querySelector(".rpt-filters");
    const filterItems = filters?.children;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Header sweeps in
    if (header) {
      tl.fromTo(header,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4 },
        0
      );
    }

    // 2. Action buttons scale in
    if (actions) {
      const btns = actions.querySelectorAll("button");
      if (btns.length) {
        tl.fromTo(btns,
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: 0.3, stagger: 0.08, ease: "back.out(1.4)" },
          0.15
        );
      }
    }

    // 3. Mailbox toggle slides in
    if (mailbox) {
      tl.fromTo(mailbox,
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.3 },
        0.25
      );
    }
    if (mailboxBtns?.length) {
      tl.fromTo(mailboxBtns,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.2, stagger: 0.06 },
        0.35
      );
    }

    // 4. Filter dropdowns stagger in
    if (filterItems?.length) {
      tl.fromTo(filterItems,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.25, stagger: 0.05 },
        0.4
      );
    }

    return () => { tl.kill(); };
  }, [tab]);

  /* ═══ HEROES TAB ENTRANCE ANIMATION ═════════════════ */
  useEffect(() => {
    if (tab !== "heroes" || !contentRef.current) return;

    const header = contentRef.current.querySelector(".hero-header");
    const actions = contentRef.current.querySelector(".hero-header-actions");
    const summaryCards = contentRef.current.querySelectorAll(".hero-stat-card");
    const countEls = contentRef.current.querySelectorAll(".hero-count-up");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Header slides in from left
    if (header) {
      tl.fromTo(header,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4 },
        0
      );
    }

    // 2. Action buttons scale in with bounce
    if (actions) {
      const btns = actions.querySelectorAll("button");
      if (btns.length) {
        tl.fromTo(btns,
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: 0.3, stagger: 0.08, ease: "back.out(1.4)" },
          0.15
        );
      }
    }

    // 3. Summary cards stagger in with scale
    if (summaryCards.length) {
      tl.fromTo(summaryCards,
        { opacity: 0, y: 15, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.1, ease: "back.out(1.2)" },
        0.25
      );
    }

    // 4. Count-up numbers
    if (countEls.length) {
      countEls.forEach((el) => {
        const target = parseInt((el as HTMLElement).dataset.target || "0", 10);
        const obj = { val: 0 };
        tl.to(obj, {
          val: target,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => { el.textContent = Math.round(obj.val).toString(); },
        }, 0.5);
      });
    }

    return () => { tl.kill(); };
  }, [tab, heroes]);

  /* ═══ HERO ACTIONS ════════════════════════════════ */
  const handleAssignHero = useCallback(async (payload: Parameters<typeof assignHero>[0]) => {
    await assignHero(payload);
  }, [assignHero]);

  const handleUnassignHero = useCallback(async (heroName: string) => {
    setUnassigning(heroName);
    try {
      await unassignHero(heroName);
    } catch { /* swallow — hook handles error state */ }
    finally { setUnassigning(null); }
  }, [unassignHero]);

  /* ═══ UPDATE PREDICTIONS WEBHOOK ═════════════════ */
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<"idle" | "success" | "error">("idle");

  const handleUpdatePredictions = useCallback(async () => {
    setPredicting(true);
    setPredictionResult("idle");
    try {
      const res = await fetch(
        "https://primary-production-405d5.up.railway.app/webhook/23bdf1a0-40d2-4265-b654-0032deabb66a",
        { method: "POST" }
      );
      setPredictionResult(res.ok ? "success" : "error");
    } catch {
      setPredictionResult("error");
    } finally {
      setPredicting(false);
      setTimeout(() => setPredictionResult("idle"), 4000);
    }
  }, []);

  return (
    <div className={`relative ${(tab === "graph" || tab === "overview") ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {/* ═══ 403 LOCKDOWN ════════════════════════════ */}
      {locked && (
        <LockdownOverlay
          onReauthorized={() => {
            refetch();
            refetchReports();
            refetchForecasts();
            refetchHeroes();
          }}
        />
      )}

      {/* ═══ SCANLINE AMBIENT ════════════════════════ */}
      <div className="shield-scanline pointer-events-none" />

      {/* ═══ TOP ACCENT LINE ═════════════════════════ */}
      <div
        ref={accentLineRef}
        className="h-[2px] origin-center bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
        style={{ transform: "scaleX(0)" }}
      />

      {/* ═══ HEADER — COMMAND BAR ════════════════════ */}
      <header
        ref={headerRef}
        className="relative flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-1)]/80 px-8 py-3.5 opacity-0 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4">
          {/* Shield logo */}
          <div
            ref={shieldIconRef}
            className="opacity-0"
          >
            <img src="/logo.webp" alt="S.H.I.E.L.D." className="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(45,212,191,0.35)]" />
          </div>
          <div ref={brandRef} className="opacity-0">
            <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-[var(--accent)] opacity-70">S.H.I.E.L.D.</span>
            <h1 className="shield-title text-sm tracking-widest text-white">
              COMMAND CENTER
            </h1>
          </div>
        </div>

        <div ref={statusRef} className="flex items-center gap-4 opacity-0">
          <button
            onClick={() => { setJarvisOpen(true); }}
            className="group relative inline-flex items-center gap-2 rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.15em] text-[var(--accent)] transition-all hover:border-[var(--accent-bright)] hover:shadow-[0_0_20px_rgba(45,212,191,0.15)]"
          >
            <svg className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
            J.A.R.V.I.S.
          </button>
          <div className="shield-pulse" />
          <span className="hidden font-mono text-[10px] tracking-wider text-[var(--text-muted)] sm:inline">
            CLEARANCE LEVEL: <span className="text-[var(--accent)]">S.H.I.E.L.D.</span>
          </span>
          <div className="h-4 w-px bg-[var(--border-strong)]" />
          <UserButton signInUrl="/" />
        </div>
      </header>

      {/* ═══ TAB BAR — TACTICAL NAV ═════════════════ */}
      <nav
        ref={navRef}
        className="border-b border-[var(--border)] bg-[var(--surface-0)]/60 px-8 opacity-0 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`relative px-5 py-3 font-mono text-xs font-medium tracking-widest uppercase transition-colors ${
                tab === t.key
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main ref={contentRef} className={`mx-auto opacity-0 ${tab === "overview" ? "max-w-full" : tab === "graph" ? "max-w-full px-4 py-3" : "max-w-6xl px-8 py-10"}`}>
        {/* ── Overview tab — Earth Map ─────────────── */}
        {tab === "overview" && (
          <EarthMap
            records={rawRecords}
            forecasts={forecasts}
            loading={loading}
            onUpdatePredictions={handleUpdatePredictions}
            predicting={predicting}
            predictionResult={predictionResult}
            onDrillDown={(sector, resource) => {
              setSelectedSector(sector);
              setSelectedResource(resource);
              handleTabChange("graph");
            }}
          />
        )}

        {/* ── Graph tab (side-by-side layout) ───── */}
        {tab === "graph" && (
          <div className="flex h-[calc(100vh-8.5rem)] gap-4">
            {/* ── LEFT SIDEBAR: selectors ─────────── */}
            <aside className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto pr-2">
              {/* Title */}
              <div>
                <span className="shield-micro-label">Resource Tracking</span>
                <h2 className="shield-title text-sm tracking-widest text-white">INVENTORY</h2>
              </div>

              {/* Days + Refresh */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">RANGE</span>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value={7}>7d</option>
                  <option value={14}>14d</option>
                  <option value={30}>30d</option>
                  <option value={60}>60d</option>
                  <option value={90}>90d</option>
                </select>
                <button onClick={refetch} className="shield-btn-primary !px-2 !py-1 !text-[10px]">
                  ↻
                </button>
              </div>

              {/* Sectors — vertical stack */}
              <div>
                <span className="mb-1.5 block font-mono text-[9px] font-medium tracking-wider text-[var(--text-muted)]">SECTORS</span>
                <div className="flex flex-col gap-1.5">
                  {ALL_SECTORS.map((s) => (
                    <TogglePill
                      key={s}
                      label={s}
                      active={selectedSector === s}
                      onToggle={() => setSelectedSector(s)}
                    />
                  ))}
                </div>
              </div>

              {/* Resources — vertical stack */}
              <div>
                <span className="mb-1.5 block font-mono text-[9px] font-medium tracking-wider text-[var(--text-muted)]">RESOURCES</span>
                <div className="flex flex-col gap-1.5">
                  {ALL_RESOURCES.map((r) => (
                    <TogglePill
                      key={r}
                      label={r}
                      active={selectedResource === r}
                      onToggle={() => setSelectedResource(r)}
                    />
                  ))}
                </div>
              </div>

              {/* Record count */}
              <p className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">
                {loading ? "LOADING INTEL…" : `${records.length} RECORD${records.length !== 1 ? "S" : ""}`}
              </p>
            </aside>

            {/* ── RIGHT: chart fills remaining space ── */}
            <div className="min-w-0 flex-1">
              <InventoryChart records={records} loading={loading} depletionRate={depletionRate} />
            </div>
          </div>
        )}

        {/* ── Reports tab ──────────────────────────── */}
        {tab === "reports" && (
          <>
            {/* Header row */}
            <div className="rpt-header mb-4 flex items-center justify-between">
              <div>
                <span className="shield-micro-label">Intelligence Log</span>
                <h2 className="shield-title shield-title-lg text-white">FIELD REPORTS</h2>
              </div>
              <div className="rpt-header-actions flex items-center gap-3">
                <button
                  onClick={() => setSubmitReportOpen(true)}
                  className="shield-btn-primary inline-flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Submit Report
                </button>
                <button
                  onClick={refetchReports}
                  className="shield-btn-primary"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Active / Archive toggle */}
            <div className="rpt-mailbox mb-4 flex items-center gap-2">
              {(["active", "archive"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setReportMailbox(m); }}
                  className={`rounded border px-4 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
                    reportMailbox === m
                      ? m === "active"
                        ? "border-[var(--accent-border)] bg-[var(--accent-dim)] text-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                        : "border-green-800/40 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.15)]"
                      : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {m === "active" ? "◉ ACTIVE" : "✓ ARCHIVE"}
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="rpt-filters mb-5 flex flex-wrap items-center gap-3">
              {/* Location */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">LOCATION</span>
                <select
                  value={rptLocation}
                  onChange={(e) => setRptLocation(e.target.value)}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  {ALL_SECTORS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Resource */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">RESOURCE</span>
                <select
                  value={rptResource}
                  onChange={(e) => setRptResource(e.target.value)}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  {ALL_RESOURCES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Hero */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">HERO</span>
                <select
                  value={rptHero}
                  onChange={(e) => setRptHero(e.target.value)}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  {ALL_HEROES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">PRIORITY</span>
                <select
                  value={rptPriority}
                  onChange={(e) => { setRptPriority(e.target.value); }}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  {ALL_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Resource Level */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">RESOURCE LEVEL</span>
                <select
                  value={rptLevel}
                  onChange={(e) => setRptLevel(e.target.value)}
                  className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  {ALL_RESOURCE_LEVELS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Clear filters */}
              {(rptLocation !== "ALL" || rptResource !== "ALL" || rptHero !== "ALL" || rptPriority !== "ALL" || rptLevel !== "ALL") && (
                <button
                  onClick={() => { setRptLocation("ALL"); setRptResource("ALL"); setRptHero("ALL"); setRptPriority("ALL"); setRptLevel("ALL"); }}
                  className="mt-4 font-mono text-[10px] tracking-wider text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ✕ CLEAR FILTERS
                </button>
              )}
            </div>

            <ReportsTable
              reports={filteredReports}
              loading={reportsLoading}
              error={reportsError}
              onRefetch={refetchReports}
            />

            <SubmitReportModal
              open={submitReportOpen}
              onClose={() => setSubmitReportOpen(false)}
              onSubmitted={refetchReports}
            />
          </>
        )}

        {/* ── Heroes tab ───────────────────────────── */}
        {tab === "heroes" && (
          <>
            {/* Header row */}
            <div className="hero-header mb-4 flex items-center justify-between">
              <div>
                <span className="shield-micro-label">Personnel Tracker</span>
                <h2 className="shield-title shield-title-lg text-white">HERO ROSTER</h2>
              </div>
              <div className="hero-header-actions flex items-center gap-3">
                <button
                  onClick={() => setAssignModalOpen(true)}
                  className="shield-btn-primary inline-flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Assign Hero
                </button>
                <button
                  onClick={() => refetchHeroes()}
                  className="shield-btn-primary"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="hero-summary-cards mb-6 grid grid-cols-3 gap-4">
              <div className="hero-stat-card rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
                <span className="block font-mono text-[9px] tracking-wider text-[var(--text-muted)]">TOTAL HEROES</span>
                <span className="hero-count-up font-mono text-2xl font-bold text-[var(--text-primary)]" data-target={heroes.length}>0</span>
              </div>
              <div className="hero-stat-card rounded-lg border border-green-800/20 bg-green-950/10 px-4 py-3">
                <span className="block font-mono text-[9px] tracking-wider text-green-400/70">ON MISSION</span>
                <span className="hero-count-up font-mono text-2xl font-bold text-green-400" data-target={heroes.filter(h => h.is_active).length}>0</span>
              </div>
              <div className="hero-stat-card rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
                <span className="block font-mono text-[9px] tracking-wider text-[var(--text-muted)]">STANDBY</span>
                <span className="hero-count-up font-mono text-2xl font-bold text-[var(--text-secondary)]" data-target={heroes.filter(h => !h.is_active).length}>0</span>
              </div>
            </div>

            <HeroTable
              heroes={heroes}
              loading={heroesLoading}
              error={heroesError}
              onUnassign={handleUnassignHero}
              unassigning={unassigning}
            />

            <AssignHeroModal
              open={assignModalOpen}
              onClose={() => setAssignModalOpen(false)}
              onAssign={handleAssignHero}
            />
          </>
        )}
      </main>

      {/* ═══ J.A.R.V.I.S. PANEL ═════════════════════ */}
      <JarvisPanel
        open={jarvisOpen}
        onClose={() => { setJarvisOpen(false); jarvisReset(); }}
        loading={jarvisLoading}
        instructions={jarvisInstructions}
        error={jarvisError}
        onSync={jarvisSync}
      />
    </div>
  );
}
