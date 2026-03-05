"use client";

import { useEffect, useRef, useState, useMemo } from "react";

/* ── Thinking dots component ─────────────────────── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="jarvis-think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" style={{ animationDelay: "0ms" }} />
      <span className="jarvis-think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" style={{ animationDelay: "200ms" }} />
      <span className="jarvis-think-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" style={{ animationDelay: "400ms" }} />
    </div>
  );
}

/* ── Thinking brain animation ────────────────────── */
function ThinkingBrain() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Outer pulsing ring */}
      <div className="jarvis-ring relative flex h-20 w-20 items-center justify-center">
        <div className="jarvis-ring-inner absolute inset-0 rounded-full border border-[var(--accent-border)]" />
        <div className="jarvis-ring-outer absolute -inset-2 rounded-full border border-[var(--accent-border)] opacity-30" />
        {/* Core icon */}
        <svg
          className="jarvis-core h-8 w-8 text-[var(--accent)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* brain / circuit icon */}
          <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 2 2.83V12a4 4 0 0 1-2 3.46V18a4 4 0 0 1-8 0v-2.54A4 4 0 0 1 6 12V9.83A3 3 0 0 1 8 7V6a4 4 0 0 1 4-4z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      </div>

      {/* Status text with dots */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--accent)] uppercase">
          J.A.R.V.I.S. Analyzing
        </span>
        <ThinkingDots />
      </div>

      {/* Subtle scanning bars */}
      <div className="flex w-full max-w-[180px] flex-col gap-1.5">
        <div className="jarvis-scan-bar h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animationDelay: "0ms" }} />
        <div className="jarvis-scan-bar h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animationDelay: "300ms" }} />
        <div className="jarvis-scan-bar h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" style={{ animationDelay: "600ms" }} />
      </div>
    </div>
  );
}

/* ── Typewriter line ─────────────────────────────── */
function TypewriterLine({
  text,
  delay,
  speed = 22,
  onDone,
}: {
  text: string;
  delay: number;
  speed?: number;
  onDone?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [started, displayed, text, speed, onDone]);

  if (!started) return null;

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="jarvis-caret ml-0.5 inline-block h-3.5 w-[2px] translate-y-[1px] bg-[var(--accent)]" />
      )}
    </span>
  );
}

/* ── Parse an instruction line into parts ─────────── */
function parseInstruction(line: string) {
  // "You should deploy Bruce Banner to Avengers Compound to stabilize Medical Kits for 1 hours."
  const match = line.match(
    /deploy\s+(.+?)\s+to\s+(.+?)\s+to stabilize\s+(.+?)\s+for\s+(.+?)\.?$/i
  );
  if (!match) return null;
  return { hero: match[1], location: match[2], resource: match[3], duration: match[4] };
}

/* ── Main Panel ──────────────────────────────────── */
export default function JarvisPanel({
  open,
  onClose,
  loading,
  instructions,
  error,
  onSync,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  instructions: string | null;
  error: string | null;
  onSync: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [allTyped, setAllTyped] = useState(false);
  const [typedCount, setTypedCount] = useState(0);

  const lines = useMemo(() => {
    if (!instructions) return [];
    return instructions
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [instructions]);

  /* Reset typed state when instructions change */
  useEffect(() => {
    setAllTyped(false);
    setTypedCount(0);
  }, [instructions]);

  useEffect(() => {
    if (typedCount >= lines.length && lines.length > 0) {
      setAllTyped(true);
    }
  }, [typedCount, lines.length]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="jarvis-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="jarvis-panel fixed right-6 top-16 z-50 flex w-[480px] max-h-[85vh] flex-col overflow-hidden rounded-xl border border-[var(--accent-border)] bg-[var(--surface-0)] shadow-[0_0_60px_rgba(45,212,191,0.08)]"
      >
        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          {/* Accent line at top */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-40" />
          <div className="flex items-center gap-3">
            {/* Jarvis icon */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)]">
              <svg
                className="h-4 w-4 text-[var(--accent)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <div>
              <span className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] opacity-70">
                STRATEGIC AI
              </span>
              <h3 className="font-mono text-sm font-semibold tracking-widest text-white">
                J.A.R.V.I.S.
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* IDLE — No instructions yet, show prompt */}
          {!loading && !instructions && !error && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-dim)]">
                <svg
                  className="h-7 w-7 text-[var(--accent)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <p className="font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
                Sync with J.A.R.V.I.S. to receive strategic deployment
                instructions based on current resource forecasts.
              </p>
              <button onClick={onSync} className="shield-btn-primary mt-2 inline-flex items-center gap-2">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Initialize Sync
              </button>
            </div>
          )}

          {/* LOADING — Thinking state */}
          {loading && <ThinkingBrain />}

          {/* ERROR */}
          {error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-800/30 bg-red-950/20">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="font-mono text-xs text-red-400">{error}</p>
              <button onClick={onSync} className="shield-btn-primary mt-1">
                Retry Sync
              </button>
            </div>
          )}

          {/* INSTRUCTIONS — Typewriter effect */}
          {instructions && !loading && (
            <div className="flex flex-col gap-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                <span className="font-mono text-[10px] tracking-[0.15em] text-green-400/80">
                  DEPLOYMENT DIRECTIVES RECEIVED
                </span>
              </div>

              {lines.map((line, i) => {
                const parsed = parseInstruction(line);
                const baseDelay = i * 1200;

                return (
                  <div
                    key={i}
                    className="jarvis-instruction rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3"
                    style={{ animationDelay: `${i * 200}ms` }}
                  >
                    {parsed ? (
                      <div className="flex flex-col gap-1.5">
                        {/* Hero + Location tag row */}
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[var(--accent)]">
                            {parsed.hero}
                          </span>
                          <svg className="h-3 w-3 text-[var(--text-muted)]" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span className="font-mono text-[10px] tracking-wider text-[var(--text-secondary)]">
                            {parsed.location}
                          </span>
                        </div>
                        {/* Typed instruction */}
                        <div className="font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
                          <TypewriterLine
                            text={`Stabilize ${parsed.resource} — ${parsed.duration}`}
                            delay={baseDelay + 300}
                            speed={18}
                            onDone={() => setTypedCount((c) => c + 1)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
                        <TypewriterLine
                          text={line}
                          delay={baseDelay}
                          speed={18}
                          onDone={() => setTypedCount((c) => c + 1)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Done indicator */}
              {allTyped && (
                <div className="jarvis-done mt-2 flex items-center justify-center gap-2 py-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--accent-border)]" />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] opacity-60">
                    ANALYSIS COMPLETE
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--accent-border)]" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-wider text-[var(--text-muted)]">
              {loading
                ? "PROCESSING…"
                : instructions
                  ? `${lines.length} DIRECTIVE${lines.length !== 1 ? "S" : ""}`
                  : "STANDBY"}
            </span>
            {instructions && !loading && (
              <button
                onClick={onSync}
                className="font-mono text-[10px] tracking-wider text-[var(--accent)] transition-colors hover:text-white"
              >
                ↻ RE-SYNC
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
