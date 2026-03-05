"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useClerk, useAuth } from "@clerk/nextjs";
import gsap from "gsap";
import { API_BASE_URL } from "@/lib/api";
import { useLockdown } from "@/hooks/useLockdown";

/**
 * Full-screen UNAUTHORIZED lockdown overlay.
 * Shown when any API call returns 403.
 * Red theme, blocks all interaction, sign-out button + "Check Again".
 * On re-authorization: epic green animation → dismiss → refetch.
 */
interface LockdownOverlayProps {
  /** Called after re-authorization animation completes so the dashboard can refetch. */
  onReauthorized?: () => void;
}

export default function LockdownOverlay({ onReauthorized }: LockdownOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const checkBtnRef = useRef<HTMLButtonElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);

  /* ── Authorized celebration refs ─────────── */
  const greenScanRef = useRef<HTMLDivElement>(null);
  const authContainerRef = useRef<HTMLDivElement>(null);
  const authTitleRef = useRef<HTMLHeadingElement>(null);
  const authSubRef = useRef<HTMLParagraphElement>(null);
  const authBadgeRef = useRef<HTMLDivElement>(null);
  const particleContainerRef = useRef<HTMLDivElement>(null);
  const greenGlowRef = useRef<HTMLDivElement>(null);

  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { clearLockdown } = useLockdown();

  const [checking, setChecking] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  /* ═══ INITIAL RED ENTRANCE ═══════════════════ */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0);
    tl.fromTo(scanRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, 0.1);
    tl.fromTo(
      iconRef.current,
      { opacity: 0, scale: 0.3, rotate: -15 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: "back.out(1.7)" },
      0.3
    );
    tl.fromTo(
      titleRef.current,
      { opacity: 0, y: -30, scaleY: 1.6 },
      { opacity: 1, y: 0, scaleY: 1, duration: 0.4, ease: "power4.out" },
      0.5
    );
    tl.fromTo(subRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8);
    tl.fromTo(lineRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, 0.9);
    tl.fromTo(msgRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, 1.1);
    tl.fromTo(btnRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 }, 1.3);
    tl.fromTo(checkBtnRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 }, 1.45);

    gsap.to(overlayRef.current, {
      boxShadow: "inset 0 0 120px rgba(220,38,38,0.15)",
      repeat: -1,
      yoyo: true,
      duration: 2,
      ease: "sine.inOut",
    });

    return () => { tl.kill(); };
  }, []);

  /* ═══ CHECK AGAIN HANDLER ════════════════════ */
  const handleCheckAgain = useCallback(async () => {
    setChecking(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/inventory?days=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        // Still unauthorized — shake the overlay
        setChecking(false);
        if (overlayRef.current) {
          gsap.timeline()
            .to(overlayRef.current, { x: -12, duration: 0.05 })
            .to(overlayRef.current, { x: 12, duration: 0.05 })
            .to(overlayRef.current, { x: -8, duration: 0.05 })
            .to(overlayRef.current, { x: 8, duration: 0.05 })
            .to(overlayRef.current, { x: -4, duration: 0.05 })
            .to(overlayRef.current, { x: 0, duration: 0.05 });
        }
        return;
      }

      // AUTHORIZED — flip state; animation fires via useEffect
      setChecking(false);
      setAuthorized(true);
    } catch {
      setChecking(false);
      // Network error — shake
      if (overlayRef.current) {
        gsap.timeline()
          .to(overlayRef.current, { x: -12, duration: 0.05 })
          .to(overlayRef.current, { x: 12, duration: 0.05 })
          .to(overlayRef.current, { x: -8, duration: 0.05 })
          .to(overlayRef.current, { x: 8, duration: 0.05 })
          .to(overlayRef.current, { x: 0, duration: 0.05 });
      }
    }
  }, [getToken]);

  /* ═══ CELEBRATION ANIMATION ══════════════════ */
  const playAuthorizedAnimation = useCallback(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Smooth background bleed from red → deep green
    tl.to(overlayRef.current, {
      background: "linear-gradient(180deg, #001a0a 0%, #00260f 40%, #000d06 100%)",
      duration: 1.0,
      ease: "power2.inOut",
    }, 0);

    // 2. Kill the red pulsing, shift to teal glow
    tl.to(overlayRef.current, {
      boxShadow: "inset 0 0 150px rgba(45,212,191,0.1)",
      duration: 0.8,
    }, 0);

    // 3. Green radial glow expands from center
    tl.fromTo(greenGlowRef.current,
      { opacity: 0, scale: 0.3 },
      { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" },
      0
    );
    tl.to(greenGlowRef.current, { opacity: 0.4, duration: 1.5 }, 1.2);

    // 4. Borders shift to teal
    const borderEls = overlayRef.current?.querySelectorAll(".lockdown-border");
    if (borderEls) {
      tl.to(borderEls, { borderColor: "rgba(45,212,191,0.35)", duration: 0.8 }, 0.2);
    }

    // 5. Fade out ALL the red content
    const redElements = [titleRef.current, subRef.current, lineRef.current, msgRef.current, btnRef.current, checkBtnRef.current, scanRef.current];
    tl.to(redElements, { opacity: 0, y: -15, duration: 0.4, stagger: 0.02, ease: "power2.in" }, 0);

    // 6. Morph the icon — remove red filter, add teal glow
    tl.to(iconRef.current?.querySelector("img") ?? iconRef.current, {
      filter: "grayscale(0) sepia(0) hue-rotate(0deg) saturate(1) drop-shadow(0 0 30px rgba(45,212,191,0.6))",
      duration: 0.8,
    }, 0.3);

    // 7. Icon lifts up to make room, with a bounce
    tl.to(iconRef.current, {
      y: -30,
      scale: 1.15,
      duration: 0.5,
      ease: "back.out(1.8)",
    }, 0.6);
    tl.to(iconRef.current, { scale: 1, duration: 0.4, ease: "power2.out" }, 1.1);

    // 8. Green scan lines sweep (two, from opposite sides)
    tl.fromTo(greenScanRef.current,
      { scaleX: 0, opacity: 1 },
      { scaleX: 1, duration: 0.7, ease: "power2.inOut" },
      0.5
    );
    tl.to(greenScanRef.current, { opacity: 0, duration: 0.8 }, 1.3);

    // 9. Auth container fades in
    tl.fromTo(authContainerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 },
      0.8
    );

    // 10. AUTHORIZED title — letter-by-letter stagger
    if (authTitleRef.current) {
      const spans = authTitleRef.current.querySelectorAll("span");
      tl.fromTo(spans,
        { opacity: 0, y: 20, rotateX: -90 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.06,
          stagger: 0.04,
          ease: "back.out(1.5)",
        },
        0.9
      );
    }

    // 11. Subtitle fades up
    tl.fromTo(authSubRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
      1.4
    );

    // 12. Badge slides in with scale pop
    tl.fromTo(authBadgeRef.current,
      { opacity: 0, scale: 0.7, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(2)" },
      1.7
    );

    // 13. Particle burst
    if (particleContainerRef.current) {
      const particles = particleContainerRef.current.children;
      tl.fromTo(particles,
        { opacity: 1, scale: 0 },
        {
          opacity: 0,
          scale: 1,
          duration: 1.4,
          stagger: { each: 0.02, from: "center" },
          ease: "power2.out",
        },
        0.8
      );
    }

    // 14. Final fade-out & dismiss
    tl.to(overlayRef.current, {
      opacity: 0,
      scale: 1.03,
      duration: 0.7,
      ease: "power3.inOut",
      onComplete: () => { clearLockdown(); onReauthorized?.(); },
    }, 2.8);

  }, [clearLockdown, onReauthorized]);

  /* ═══ Play celebration AFTER React renders the green elements ═══ */
  useEffect(() => {
    if (authorized) playAuthorizedAnimation();
  }, [authorized, playAuthorizedAnimation]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden opacity-0"
      style={{ background: "linear-gradient(180deg, #0a0000 0%, #1a0000 40%, #0d0000 100%)" }}
    >
      {/* Borders */}
      <div className="lockdown-border pointer-events-none absolute inset-0 border-[3px] border-red-600/40 transition-colors duration-500" />
      <div className="lockdown-border pointer-events-none absolute inset-2 border border-red-900/30 transition-colors duration-500" />

      {/* Green radial glow (celebration) — sits behind content */}
      <div
        ref={greenGlowRef}
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
        style={{ background: "radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)" }}
      />

      {/* Red scan line */}
      <div
        ref={scanRef}
        className="pointer-events-none absolute inset-x-0 top-1/3 h-px origin-left bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"
        style={{ transform: "scaleX(0)" }}
      />

      {/* Green scan line (celebration) */}
      <div
        ref={greenScanRef}
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] origin-center bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-0"
        style={{ transform: "scaleX(0)" }}
      />

      {/* Animated red scan sweep */}
      {!authorized && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-x-0 h-24 bg-gradient-to-b from-red-500/5 to-transparent"
            style={{ animation: "lockdownScan 4s ease-in-out infinite" }}
          />
        </div>
      )}

      {/* Particle burst container (celebration) */}
      <div ref={particleContainerRef} className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => {
          const angle = (i / 30) * Math.PI * 2;
          const dist = 200 + Math.random() * 250;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          const size = 3 + Math.random() * 5;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: size,
                height: size,
                background: i % 3 === 0
                  ? "rgba(45,212,191,0.9)"
                  : i % 3 === 1
                    ? "rgba(16,185,129,0.8)"
                    : "rgba(255,255,255,0.7)",
                transform: `translate(${x}px, ${y}px) scale(0)`,
                boxShadow: "0 0 6px rgba(45,212,191,0.5)",
                opacity: 0,
              }}
            />
          );
        })}
      </div>

      {/* S.H.I.E.L.D. logo */}
      <div ref={iconRef} className="mb-6 opacity-0">
        <img
          src="/logo.webp"
          alt="S.H.I.E.L.D."
          className="h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(220,38,38,0.5)]"
          style={{ filter: "grayscale(0.3) sepia(1) hue-rotate(-30deg) saturate(3)" }}
        />
      </div>

      {/* ── RED STATE: UNAUTHORIZED ─────────── */}
      <h1
        ref={titleRef}
        className="mb-2 font-mono text-4xl font-black tracking-[0.35em] text-red-500 sm:text-5xl"
        style={{ textShadow: "0 0 30px rgba(220,38,38,0.6), 0 0 60px rgba(220,38,38,0.3)" }}
      >
        UNAUTHORIZED
      </h1>

      <p
        ref={subRef}
        className="mb-6 font-mono text-xs tracking-[0.25em] text-red-400/70"
      >
        CLEARANCE LEVEL: <span className="font-bold text-red-400">REVOKED</span>
      </p>

      <div
        ref={lineRef}
        className="mb-6 h-px w-64 origin-center bg-gradient-to-r from-transparent via-red-600 to-transparent"
        style={{ transform: "scaleX(0)" }}
      />

      <div
        ref={msgRef}
        className="mx-4 mb-8 max-w-md rounded border border-red-900/50 bg-red-950/30 px-6 py-4 text-center backdrop-blur-sm"
      >
        <p className="font-mono text-[11px] leading-relaxed tracking-wider text-red-300/80">
          ACCESS DENIED — YOUR SESSION HAS BEEN FLAGGED BY THE S.H.I.E.L.D. SECURITY FRAMEWORK.
          ALL COMMAND CENTER OPERATIONS ARE LOCKED.
        </p>
        <p className="mt-2 font-mono text-[10px] tracking-wider text-red-500/60">
          ERROR 403 • BEARER TOKEN REJECTED
        </p>
      </div>

      {/* Sign out button */}
      <button
        ref={btnRef}
        onClick={() => signOut({ redirectUrl: "/" })}
        className="mb-3 rounded border border-red-700/50 bg-red-950/50 px-6 py-2.5 font-mono text-xs font-bold tracking-[0.2em] text-red-400 opacity-0 transition-all hover:border-red-600 hover:bg-red-900/40 hover:text-red-300 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"
      >
        SIGN OUT &amp; RE-AUTHENTICATE
      </button>

      {/* Check Again button */}
      <button
        ref={checkBtnRef}
        onClick={handleCheckAgain}
        disabled={checking || authorized}
        className="rounded border border-red-800/30 bg-transparent px-6 py-2 font-mono text-[10px] font-medium tracking-[0.2em] text-red-500/70 opacity-0 transition-all hover:border-red-600/50 hover:text-red-400 hover:shadow-[0_0_12px_rgba(220,38,38,0.15)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {checking ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-800 border-t-red-400" />
            VERIFYING…
          </span>
        ) : (
          "CHECK AGAIN"
        )}
      </button>

      {/* ── GREEN STATE: AUTHORIZED (centered container) ─── */}
      {authorized && (
        <div
          ref={authContainerRef}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center opacity-0"
          style={{ paddingTop: "4rem" }}
        >
          <h1
            ref={authTitleRef}
            className="mb-3 font-mono text-4xl font-black tracking-[0.35em] sm:text-5xl"
            style={{
              textShadow: "0 0 40px rgba(45,212,191,0.7), 0 0 80px rgba(45,212,191,0.3), 0 0 120px rgba(45,212,191,0.15)",
            }}
          >
            {"AUTHORIZED".split("").map((ch, i) => (
              <span
                key={i}
                className="inline-block text-teal-400"
                style={{ opacity: 0 }}
              >
                {ch}
              </span>
            ))}
          </h1>

          <p
            ref={authSubRef}
            className="mb-6 font-mono text-xs tracking-[0.25em] text-teal-300/80 opacity-0"
          >
            CLEARANCE LEVEL: <span className="font-bold text-teal-300">S.H.I.E.L.D.</span> — ACCESS GRANTED
          </p>

          <div
            ref={authBadgeRef}
            className="flex items-center gap-2 rounded border border-teal-500/40 bg-teal-950/40 px-4 py-2 opacity-0 backdrop-blur-sm"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-teal-300">
              COMMAND CENTER UNLOCKED
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes lockdownScan {
          0%   { top: -6rem; }
          100% { top: calc(100% + 6rem); }
        }
      `}</style>
    </div>
  );
}
