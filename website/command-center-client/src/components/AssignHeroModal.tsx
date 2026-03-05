"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { AssignPayload } from "@/hooks/useHeroes";

/* ── known values ─────────────────────────────────── */
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

const ALL_HEROES = [
  "Bruce Banner",
  "Natasha Romanoff",
  "Peter Parker",
  "Steve Rogers",
  "Thor Odinson",
  "Tony Stark",
];

/* ── duration tick labels ─────────────────────────── */
const DURATION_TICKS = [1, 2, 4, 6, 8, 12, 16, 20, 24];

interface AssignHeroModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (payload: AssignPayload) => Promise<void>;
}

export default function AssignHeroModal({ open, onClose, onAssign }: AssignHeroModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [heroName, setHeroName] = useState(ALL_HEROES[0]);
  const [customHero, setCustomHero] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [resource, setResource] = useState(ALL_RESOURCES[0]);
  const [location, setLocation] = useState(ALL_SECTORS[0]);
  const [duration, setDuration] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setHeroName(ALL_HEROES[0]);
      setCustomHero("");
      setUseCustom(false);
      setResource(ALL_RESOURCES[0]);
      setLocation(ALL_SECTORS[0]);
      setDuration(4);
      setResult("idle");
      setErrorMsg("");
    }
  }, [open]);

  /* Blur page */
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("__next") ?? document.body.firstElementChild;
    if (root instanceof HTMLElement) {
      root.style.filter = "blur(4px)";
      root.style.transition = "filter 0.2s ease";
    }
    return () => {
      if (root instanceof HTMLElement) root.style.filter = "";
    };
  }, [open]);

  /* Animate in */
  useEffect(() => {
    if (!open) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (overlayRef.current) {
      tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
    }
    if (panelRef.current) {
      tl.fromTo(panelRef.current, { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.35 }, 0.1);

      const accent = panelRef.current.querySelector(".modal-accent") as HTMLElement;
      if (accent) tl.fromTo(accent, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 0.25);

      const fields = panelRef.current.querySelectorAll(".form-field");
      if (fields.length) {
        tl.fromTo(fields, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, stagger: 0.05 }, 0.35);
      }
    }
    return () => { tl.kill(); };
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Prevent body scroll */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* Submit */
  const handleSubmit = useCallback(async () => {
    const name = useCustom ? customHero.trim() : heroName;
    if (!name) { setErrorMsg("Hero name is required"); return; }
    setSubmitting(true);
    setResult("idle");
    setErrorMsg("");
    try {
      await onAssign({
        hero_name: name,
        active_resource: resource,
        active_location: location,
        duration_hours: duration,
      });
      setResult("success");
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setResult("error");
      setErrorMsg(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setSubmitting(false);
    }
  }, [useCustom, customHero, heroName, resource, location, duration, onAssign, onClose]);

  if (!open || typeof window === "undefined") return null;

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative mx-4 w-full max-w-lg rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-glow)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="modal-accent absolute inset-x-0 top-0 h-[2px] origin-center rounded-t-lg bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ transform: "scaleX(0)" }} />

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="px-6 pb-6 pt-8">
          {/* Header */}
          <div className="mb-6">
            <span className="shield-micro-label">Hero Deployment</span>
            <h2 className="shield-title text-base tracking-widest text-white">ASSIGN HERO</h2>
          </div>

          {/* Hero name */}
          <div className="form-field mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)]">HERO</label>
              <button
                type="button"
                onClick={() => setUseCustom(!useCustom)}
                className="font-mono text-[9px] tracking-wider text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
              >
                {useCustom ? "← SELECT HERO" : "+ CUSTOM"}
              </button>
            </div>
            {useCustom ? (
              <input
                type="text"
                value={customHero}
                onChange={(e) => setCustomHero(e.target.value)}
                placeholder="Enter hero name…"
                className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-border)] focus:outline-none"
              />
            ) : (
              <select
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
              >
                {ALL_HEROES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            )}
          </div>

          {/* Resource */}
          <div className="form-field mb-4">
            <label className="mb-2 block font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)]">RESOURCE</label>
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
            >
              {ALL_RESOURCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="form-field mb-4">
            <label className="mb-2 block font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)]">LOCATION</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-border)] focus:outline-none"
            >
              {ALL_SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Duration slider */}
          <div className="form-field mb-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)]">DURATION</label>
              <span className="rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2 py-0.5 font-mono text-sm font-bold text-[var(--accent)]">
                {duration}h
              </span>
            </div>

            {/* Slider track */}
            <div className="relative px-1">
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="shield-slider w-full"
              />
              {/* Tick marks */}
              <div className="mt-1 flex justify-between px-0.5">
                {DURATION_TICKS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDuration(t)}
                    className={`font-mono text-[8px] transition-colors ${
                      duration === t ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {t}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="mb-4 rounded border border-red-800/30 bg-red-950/20 px-3 py-2 font-mono text-[10px] text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Success */}
          {result === "success" && (
            <div className="mb-4 rounded border border-green-800/30 bg-green-950/20 px-3 py-2 font-mono text-[10px] text-green-400">
              ✓ HERO DEPLOYED SUCCESSFULLY
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || result === "success"}
            className="shield-btn-primary w-full disabled:opacity-40"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" />
                DEPLOYING…
              </span>
            ) : result === "success" ? (
              "✓ DEPLOYED"
            ) : (
              "DEPLOY HERO"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
