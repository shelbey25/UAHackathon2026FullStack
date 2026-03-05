"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUser, useAuth } from "@clerk/nextjs";
import { useLockdown } from "@/hooks/useLockdown";
import gsap from "gsap";
import { API_BASE_URL } from "@/lib/api";

type Priority = "ROUTINE" | "HIGH" | "AVENGERS_LEVEL_THREAT";

const PRIORITY_OPTIONS: { value: Priority; label: string; style: string }[] = [
  {
    value: "ROUTINE",
    label: "ROUTINE",
    style: "border-green-800/30 bg-green-950/30 text-green-400",
  },
  {
    value: "HIGH",
    label: "HIGH",
    style: "border-yellow-800/30 bg-yellow-950/30 text-yellow-400",
  },
  {
    value: "AVENGERS_LEVEL_THREAT",
    label: "AVENGERS",
    style: "border-red-800/30 bg-red-950/30 text-red-400",
  },
];

interface SubmitReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SubmitReportModal({
  open,
  onClose,
  onSubmitted,
}: SubmitReportModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { user } = useUser();
  const { getToken } = useAuth();
  const { triggerLockdown } = useLockdown();

  const [rawText, setRawText] = useState("");
  const [priority, setPriority] = useState<Priority>("ROUTINE");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  /* reset form when opened */
  useEffect(() => {
    if (open) {
      setRawText("");
      setPriority("ROUTINE");
      setResult("idle");
      setErrorMsg("");
    }
  }, [open]);

  /* blur page behind modal */
  useEffect(() => {
    if (!open) return;
    const root =
      document.getElementById("__next") ?? document.body.firstElementChild;
    if (root instanceof HTMLElement) {
      root.style.filter = "blur(4px)";
      root.style.transition = "filter 0.2s ease";
    }
    return () => {
      if (root instanceof HTMLElement) {
        root.style.filter = "";
      }
    };
  }, [open]);

  /* animate in */
  useEffect(() => {
    if (!open) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (overlayRef.current) {
      tl.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2 },
        0
      );
    }
    if (panelRef.current) {
      tl.fromTo(
        panelRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35 },
        0.1
      );

      const accent = panelRef.current.querySelector(
        ".modal-accent"
      ) as HTMLElement;
      if (accent) {
        tl.fromTo(
          accent,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.4, ease: "power2.inOut" },
          0.25
        );
      }

      const items = panelRef.current.querySelectorAll(".form-item");
      if (items.length) {
        tl.fromTo(
          items,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.2, stagger: 0.06 },
          0.35
        );
      }
    }

    return () => {
      tl.kill();
    };
  }, [open]);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* lock body scroll */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* submit handler */
  const handleSubmit = useCallback(async () => {
    if (!rawText.trim()) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) {
      setErrorMsg("Unable to determine your email. Please sign in again.");
      setResult("error");
      return;
    }

    setSubmitting(true);
    setResult("idle");
    setErrorMsg("");

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/reports/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawText: rawText.trim(), priority, email }),
      });

      if (res.status === 403) { triggerLockdown(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Upload failed (${res.status})`);
      }

      setResult("success");
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }, [rawText, priority, user, getToken, triggerLockdown, onSubmitted, onClose]);

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
        {/* Accent line */}
        <div
          className="modal-accent absolute inset-x-0 top-0 h-[2px] origin-center rounded-t-lg bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
          style={{ transform: "scaleX(0)" }}
        />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-5">
          <span className="shield-micro-label">New Transmission</span>
          <h2 className="shield-title text-sm tracking-widest text-white">
            SUBMIT FIELD REPORT
          </h2>
          {user && (
            <p className="mt-1 font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
              REPORTING AS:{" "}
              <span className="text-[var(--accent)]">
                {user.fullName ?? user.primaryEmailAddress?.emailAddress}
              </span>
            </p>
          )}
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          {/* Priority selector */}
          <div className="form-item">
            <span className="mb-2 block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">
              PRIORITY LEVEL
            </span>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`rounded border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-widest transition-all ${
                    priority === opt.value
                      ? `${opt.style} shadow-[0_0_8px_rgba(45,212,191,0.1)]`
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intel text */}
          <div className="form-item">
            <span className="mb-2 block font-mono text-[10px] font-medium tracking-wider text-[var(--text-muted)]">
              INTEL REPORT
            </span>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Describe the situation in detail…"
              rows={5}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-0)] p-4 font-mono text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-border)] focus:outline-none focus:shadow-[0_0_12px_var(--accent-glow)] transition-all"
            />
            <p className="mt-1 text-right font-mono text-[9px] tracking-wider text-[var(--text-muted)]">
              {rawText.length > 0
                ? `${rawText.trim().length} CHARS`
                : "REQUIRED"}
            </p>
          </div>

          {/* Error / success feedback */}
          {result === "error" && (
            <div className="form-item rounded border border-red-800/40 bg-red-950/20 px-4 py-2.5 font-mono text-[11px] tracking-wider text-red-400">
              ✗ {errorMsg}
            </div>
          )}
          {result === "success" && (
            <div className="form-item rounded border border-green-800/40 bg-green-950/20 px-4 py-2.5 font-mono text-[11px] tracking-wider text-green-400">
              ✓ REPORT SUBMITTED — PROCESSING…
            </div>
          )}

          {/* Submit button */}
          <div className="form-item flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 font-mono text-[11px] font-medium tracking-wider text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !rawText.trim() || result === "success"}
              className="shield-btn-primary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--surface-3)] border-t-[var(--accent)]" />
                  TRANSMITTING…
                </>
              ) : result === "success" ? (
                "✓ SENT"
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                  SUBMIT REPORT
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
