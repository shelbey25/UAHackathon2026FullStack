"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import gsap from "gsap";
import type { InventoryRecord } from "@/hooks/useInventory";
import type { ForecastResource } from "@/hooks/useForecast";

/* ── sector positions (% relative to image bounds) ─── */
interface SectorPin {
  name: string;
  x: number;
  y: number;
}

const SECTORS: SectorPin[] = [
  { name: "Avengers Compound", x: 28, y: 35 },
  { name: "New Asgard",        x: 50, y: 28 },
  { name: "Sanctum Sanctorum", x: 24, y: 38 },
  { name: "Sokovia",           x: 54, y: 34 },
  { name: "Wakanda",           x: 56, y: 58 },
];

const ALL_RESOURCES = [
  "Arc Reactor Cores",
  "Clean Water (L)",
  "Medical Kits",
  "Pym Particles",
  "Vibranium (kg)",
];

type SectorStatus = "stable" | "warning" | "critical";

const STATUS_COLORS: Record<SectorStatus, string> = {
  stable:   "#22c55e",
  warning:  "#eab308",
  critical: "#ef4444",
};

/* ─────────────────────────────────────────────────── */
interface EarthMapProps {
  records: InventoryRecord[];
  forecasts: ForecastResource[];
  loading: boolean;
  onUpdatePredictions: () => void;
  predicting: boolean;
  predictionResult: "idle" | "success" | "error";
  onDrillDown?: (sector: string, resource: string) => void;
}

export default function EarthMap({
  records,
  forecasts,
  loading,
  onUpdatePredictions,
  predicting,
  predictionResult,
  onDrillDown,
}: EarthMapProps) {
  const earthWrapRef   = useRef<HTMLDivElement>(null);
  const imgContRef     = useRef<HTMLDivElement>(null);
  const dotsRef        = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef       = useRef<HTMLDivElement>(null);
  const cardsRef       = useRef<HTMLDivElement>(null);
  const titleRef       = useRef<HTMLDivElement>(null);
  const legendRef      = useRef<HTMLDivElement>(null);
  const controlsRef    = useRef<HTMLDivElement>(null);
  const scanRingRef    = useRef<HTMLDivElement>(null);
  const prevSelected   = useRef<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const displayName = selected || prevSelected.current || "";

  /* ═══ helper: hours → status (3d / 14d boundaries) ══ */
  const hrsToStatus = (hrs: number): SectorStatus => {
    if (hrs < 72) return "critical";       // < 3 days
    if (hrs < 336) return "warning";       // 3–14 days
    return "stable";                       // 15+ days
  };

  /* ═══ compute per-sector status (worst resource wins) ═ */
  const sectorStatuses = useMemo(() => {
    const out: Record<string, SectorStatus> = {};
    const rank: Record<SectorStatus, number> = { stable: 0, warning: 1, critical: 2 };

    for (const s of SECTORS) {
      const sf = forecasts.filter((f) => f.location === s.name);
      let worst: SectorStatus = "stable";

      for (const f of sf) {
        if (f.depletionRate >= 0) continue;
        const latest = records
          .filter((r) => r.sector_id === f.location && r.resource_type === f.resource)
          .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
        if (!latest || latest.stock_level <= 0) { worst = "critical"; break; }
        const hrs = latest.stock_level / Math.abs(f.depletionRate);
        const s2 = hrsToStatus(hrs);
        if (rank[s2] > rank[worst]) worst = s2;
      }
      out[s.name] = worst;
    }
    return out;
  }, [forecasts, records]);

  /* ═══ sector detail data ════════════════════════ */
  const sectorData = useMemo(() => {
    if (!selected) return null;

    return ALL_RESOURCES.map((resource) => {
      const latest = records
        .filter((r) => r.sector_id === selected && r.resource_type === resource)
        .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];

      const fc = forecasts.find(
        (f) => f.location === selected && f.resource === resource
      );

      let status: SectorStatus = "stable";
      let hoursLeft: number | null = null;
      let expiresAt: string | null = null;

      if (fc && fc.depletionRate < 0 && latest && latest.stock_level > 0) {
        const hrs = latest.stock_level / Math.abs(fc.depletionRate);
        hoursLeft = hrs;
        status = hrsToStatus(hrs);

        const zeroDate = new Date(
          new Date(latest.timestamp).getTime() + hrs * 3_600_000
        );
        expiresAt = zeroDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      return {
        resource,
        stock: latest?.stock_level ?? 0,
        usageRate: latest?.usage_rate_hourly ?? 0,
        depletionRate: fc?.depletionRate ?? 0,
        status,
        hoursLeft,
        expiresAt,
      };
    });
  }, [selected, records, forecasts]);

  /* ═══ entrance animation ════════════════════════ */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // scan ring
    tl.fromTo(
      scanRingRef.current,
      { scale: 0, opacity: 0.8 },
      { scale: 2.5, opacity: 0, duration: 1.4, ease: "power2.out" },
      0
    );

    // earth image scales in with brightness flash
    tl.fromTo(
      imgContRef.current,
      { opacity: 0, scale: 0.7, filter: "brightness(2.5) blur(8px)" },
      { opacity: 1, scale: 1, filter: "brightness(1) blur(0px)", duration: 1.4, ease: "power2.out" },
      0.1
    );

    // title
    tl.fromTo(
      titleRef.current,
      { opacity: 0, y: -15 },
      { opacity: 1, y: 0, duration: 0.5 },
      0.6
    );

    // controls
    tl.fromTo(
      controlsRef.current,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4 },
      0.8
    );

    // dots stagger in
    const dots = dotsRef.current.filter(Boolean);
    if (dots.length) {
      tl.fromTo(
        dots,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.35, stagger: 0.12, ease: "back.out(3)" },
        1.0
      );
    }

    // legend
    tl.fromTo(
      legendRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4 },
      1.5
    );

    return () => { tl.kill(); };
  }, []);

  /* ═══ select / deselect transition ══════════════ */

  useEffect(() => {
    if (!imgContRef.current) return;

    if (selected) {
      // find the sector pin to zoom toward it
      const pin = SECTORS.find((s) => s.name === selected);
      // compute translate so the pin moves toward screen center
      // pin.x/y are % of the image; shift so that point moves roughly to center
      const tx = pin ? (50 - pin.x) * 0.6 : 0; // % offset
      const ty = pin ? (50 - pin.y) * 0.6 : 0;

      gsap.to(imgContRef.current, {
        x: `${tx}%`,
        y: `${ty}%`,
        scale: 1.6,
        filter: "blur(6px) brightness(0.35)",
        duration: 1.2,
        ease: "power3.inOut",
      });
      // fade out title + controls
      if (titleRef.current) {
        gsap.to(titleRef.current, { y: -20, opacity: 0, duration: 0.5, ease: "power2.in" });
      }
      if (controlsRef.current) {
        gsap.to(controlsRef.current, { y: -20, opacity: 0, duration: 0.5, ease: "power2.in" });
      }
      if (legendRef.current) {
        gsap.to(legendRef.current, { y: 20, opacity: 0, duration: 0.5, ease: "power2.in" });
      }
      // floating header
      if (panelRef.current) {
        gsap.fromTo(
          panelRef.current,
          { y: -30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.5 }
        );
      }
      // material cards area
      if (cardsRef.current) {
        gsap.fromTo(
          cardsRef.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.7 }
        );
      }
    } else if (prevSelected.current && !closing) {
      // handled by handleClose animation — skip if closing already ran it
    }

    prevSelected.current = selected;
  }, [selected]);

  /* ═══ animated close ════════════════════════════ */
  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);

    const tl = gsap.timeline({
      onComplete: () => {
        setSelected(null);
        setClosing(false);
      },
    });

    // fade out panel + cards
    if (panelRef.current) {
      tl.to(panelRef.current, { y: -30, opacity: 0, duration: 0.5, ease: "power2.in" }, 0);
    }
    if (cardsRef.current) {
      tl.to(cardsRef.current, { y: 40, opacity: 0, duration: 0.5, ease: "power2.in" }, 0.05);
    }

    // bring earth back
    if (imgContRef.current) {
      tl.to(imgContRef.current, {
        x: "0%",
        y: "0%",
        scale: 1,
        filter: "blur(0px) brightness(1)",
        duration: 1.0,
        ease: "power3.inOut",
      }, 0.2);
    }

    // fade title + controls back in
    if (titleRef.current) {
      tl.to(titleRef.current, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.6);
    }
    if (controlsRef.current) {
      tl.to(controlsRef.current, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.65);
    }
    if (legendRef.current) {
      tl.to(legendRef.current, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.7);
    }
  }, [closing]);

  /* ═══ dot click handler ═════════════════════════ */
  const handleDotClick = useCallback((name: string) => {
    if (closing) return;
    setSelected((prev) => {
      if (prev === name) {
        // deselecting — trigger animated close instead
        handleClose();
        return prev; // keep mounted, handleClose will clear it
      }
      return name;
    });
  }, [closing, handleClose]);

  /* ═══ render ════════════════════════════════════ */
  return (
    <div
      ref={earthWrapRef}
      className="earth-map-root relative w-full overflow-hidden"
      style={{ height: "calc(100vh - 11rem)" }}
    >
      {/* ── scan ring (entrance only) ─────────────── */}
      <div
        ref={scanRingRef}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 260,
          height: 260,
          border: "2px solid var(--accent)",
          opacity: 0,
        }}
      />

      {/* ── title overlay ─────────────────────────── */}
      <div ref={titleRef} className="absolute left-6 top-4 z-10" style={{ opacity: 0 }}>
        <span className="shield-micro-label">Global Operations</span>
        <p className="shield-title shield-title-md text-[var(--text-secondary)]">
          SECTOR MAP
        </p>
      </div>

      {/* ── controls overlay ──────────────────────── */}
      <div ref={controlsRef} className="absolute right-4 top-4 z-10 flex items-center gap-3" style={{ opacity: 0 }}>
        <button
          onClick={onUpdatePredictions}
          disabled={predicting}
          className="shield-btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {predicting ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--surface-3)] border-t-[var(--accent)]" />
              UPDATING…
            </>
          ) : (
            "Update Predictions"
          )}
        </button>
        {predictionResult === "success" && (
          <span className="font-mono text-[10px] tracking-wider text-green-400">✓ UPDATED</span>
        )}
        {predictionResult === "error" && (
          <span className="font-mono text-[10px] tracking-wider text-red-400">✗ FAILED</span>
        )}
      </div>

      {/* ── earth image + dots ────────────────────── */}
      <div
        ref={imgContRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ willChange: "transform, filter", opacity: 0 }}
      >
        <div className="earth-scene relative">
          {/* ambient glow behind the image */}
          <div className="earth-ambient pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2" />

          {/* rotating scan orbit ring */}
          <div className="earth-orbit pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />

          <img
            src="/earth.png"
            alt="Earth — S.H.I.E.L.D. Global Map"
            className="earth-img pointer-events-none h-auto max-h-[68vh] w-auto select-none"
            draggable={false}
          />

          {/* sector dots */}
          {SECTORS.map((s, i) => {
            const status = sectorStatuses[s.name] || "stable";
            const color  = STATUS_COLORS[status];
            const isSel  = selected === s.name;

            return (
              <button
                key={s.name}
                ref={(el) => { dotsRef.current[i] = el; }}
                onClick={() => handleDotClick(s.name)}
                className="sector-dot group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: 0 }}
                aria-label={`Select sector: ${s.name}`}
              >
                {/* ping ring */}
                <span
                  className="sector-ping absolute inset-[-4px] rounded-full"
                  style={{
                    backgroundColor: color,
                    opacity: 0.35,
                    animationDuration: status === "critical" ? "1s" : status === "warning" ? "1.6s" : "2.4s",
                  }}
                />
                {/* hover glow */}
                <span
                  className={`absolute -inset-3 rounded-full transition-all duration-300 ${
                    isSel
                      ? "scale-[2] opacity-30"
                      : "scale-100 opacity-0 group-hover:scale-150 group-hover:opacity-25"
                  }`}
                  style={{ backgroundColor: color }}
                />
                {/* core dot */}
                <span
                  className={`relative block rounded-full border transition-all duration-300 ${
                    isSel
                      ? "h-[18px] w-[18px] border-white/50"
                      : "h-3 w-3 border-transparent group-hover:h-[14px] group-hover:w-[14px] group-hover:border-white/30"
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}, 0 0 30px ${color}55`,
                  }}
                />
                {/* label tooltip */}
                <span className="sector-label pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-sm border border-[var(--border-strong)] bg-[var(--surface-2)]/95 px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[0.15em] text-[var(--text-primary)] opacity-0 shadow-lg backdrop-blur-md transition-all duration-200 group-hover:opacity-100 group-hover:mt-2">
                  {s.name.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── sector detail (right 2/3) ─────────── */}
      {(selected || closing) && (
        <div className="absolute inset-0 z-20 flex justify-center px-10 py-6">
          <div className="flex w-full max-w-[70%] flex-col min-h-0">
          {/* floating header */}
          <div ref={panelRef} className="mb-5 flex items-start justify-between" style={{ opacity: 0 }}>
            <div>
              <span className="shield-micro-label">Sector Intelligence</span>
              <h3 className="shield-title shield-title-lg mt-1 text-white">
                {displayName.toUpperCase()}
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[sectorStatuses[displayName] || "stable"],
                    boxShadow: `0 0 8px ${STATUS_COLORS[sectorStatuses[displayName] || "stable"]}`,
                  }}
                />
                <span className="font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
                  STATUS:{" "}
                  <span
                    style={{ color: STATUS_COLORS[sectorStatuses[displayName] || "stable"] }}
                    className="font-semibold"
                  >
                    {(sectorStatuses[displayName] || "stable").toUpperCase()}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
            >
              ✕ CLOSE
            </button>
          </div>

          <div className="shield-divider-accent mb-5" />

          {/* material cards grid */}
          <div ref={cardsRef} className="flex-1 overflow-y-auto" style={{ opacity: 0 }}>
            <span className="shield-micro-label mb-3 block">Material Inventory</span>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--surface-3)] border-t-[var(--accent)]" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sectorData?.map((item, i) => {
                  const col = STATUS_COLORS[item.status];
                  return (
                    <div
                      key={item.resource}
                      onClick={() => onDrillDown?.(displayName, item.resource)}
                      className="material-card shield-panel cursor-pointer overflow-visible border-l-2 p-4 transition-all hover:scale-[1.02] hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-glow)]"
                      style={{
                        animationDelay: `${i * 0.07}s`,
                        borderLeftColor: col,
                      }}
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">
                          {item.resource}
                        </p>
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: col, boxShadow: `0 0 6px ${col}` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <span className="block font-mono text-[8px] tracking-wider text-[var(--text-muted)]">
                            STOCK
                          </span>
                          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                            {item.stock.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div>
                          <span className="block font-mono text-[8px] tracking-wider text-[var(--text-muted)]">
                            TREND
                          </span>
                          <span
                            className={`font-mono text-sm font-bold ${
                              item.depletionRate < -0.5
                                ? "text-red-400"
                                : item.depletionRate < 0
                                ? "text-yellow-400"
                                : "text-green-400"
                            }`}
                          >
                            {item.depletionRate >= 0 ? "+" : ""}
                            {item.depletionRate.toFixed(2)}/hr
                          </span>
                        </div>
                        <div className="col-span-2 mt-1 border-t border-[var(--border)] pt-1.5">
                          <span className="block font-mono text-[8px] tracking-wider text-[var(--text-muted)]">
                            {item.hoursLeft != null ? "RUNS OUT" : "EXPIRES"}
                          </span>
                          {item.hoursLeft != null && item.expiresAt ? (
                            <span className={`font-mono text-xs font-semibold ${
                              item.status === "critical" ? "text-red-400" : item.status === "warning" ? "text-yellow-400" : "text-green-400"
                            }`}>
                              {item.expiresAt}
                              <span className="ml-1.5 text-[9px] font-normal text-[var(--text-muted)]">
                                ({item.hoursLeft < 24
                                  ? `${item.hoursLeft.toFixed(1)}h`
                                  : `${(item.hoursLeft / 24).toFixed(1)}d`})
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-green-400">NO DEPLETION</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ── legend ────────────────────────────────── */}
      <div
        ref={legendRef}
        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-6 rounded-sm border border-[var(--border)] bg-[var(--surface-1)]/70 px-5 py-2 backdrop-blur-md"
        style={{ opacity: 0 }}
      >
        {(["stable", "warning", "critical"] as SectorStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: STATUS_COLORS[s],
                boxShadow: `0 0 6px ${STATUS_COLORS[s]}`,
              }}
            />
            <span className="font-mono text-[9px] font-medium tracking-wider text-[var(--text-muted)]">
              {s.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
