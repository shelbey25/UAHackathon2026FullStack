"use client";

import { useEffect, useRef, useCallback } from "react";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ── Presentation data ───────────────────────────── */
const TECH_STACK = {
  Frontend: ["Next.js 16", "React 19", "Tailwind CSS 4", "GSAP 3", "Clerk", "Recharts", "TypeScript"],
  Backend: ["Express", "FastAPI", "Railway", "N8N", "PostgreSQL"],
};

const DATA_FLOW_STEPS = [
  {
    phase: "01",
    title: "Authentication",
    body: "Clerk handles sign-on across frontend and backend — one session, full access.",
    tag: "CLERK → FRONTEND → BACKEND API",
  },
  {
    phase: "02",
    title: "Inventory Data",
    body: "Resource data lives in PostgreSQL and is served through an authenticated API.",
    tag: "POSTGRES → AUTHENTICATED API → FRONTEND",
  },
  {
    phase: "03",
    title: "Report Processing",
    body: "Field reports are PII-redacted, processed by an LLM via N8N, then restored and persisted.",
    tag: "USER → PII REDACTION → N8N → LLM → RESTORE → DATABASE",
  },
  {
    phase: "04",
    title: "Mission Dispatch",
    body: "Operators review reports and inventory, then assign heroes to missions from the dashboard.",
    tag: "DASHBOARD ANALYSIS → HERO ASSIGNMENT → MISSION DISPATCH",
  },
];

/* ── Reusable section wrapper ────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent" />
      <span className="shield-micro-label shrink-0">{children}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent" />
    </div>
  );
}

export default function LoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const microRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const clerkRef = useRef<HTMLDivElement>(null);
  const scanLine1 = useRef<HTMLDivElement>(null);
  const scanLine2 = useRef<HTMLDivElement>(null);

  /* presentation refs */
  const presentationRef = useRef<HTMLDivElement>(null);

  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/dashboard");
    }
  }, [isSignedIn, router]);

  /* ── Hero entrance animation ───────────────────── */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(scanLine1.current, { scaleX: 0 }, { scaleX: 1, duration: 0.8 }, 0);
    tl.fromTo(scanLine2.current, { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, 0.2);
    tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3);
    tl.fromTo(microRef.current,
      { opacity: 0, width: 0 },
      { opacity: 1, width: "auto", duration: 0.6, ease: "power2.inOut" },
      0.5
    );

    if (titleRef.current) {
      const text = titleRef.current.textContent || "";
      titleRef.current.innerHTML = "";
      const chars = text.split("").map((ch) => {
        const span = document.createElement("span");
        span.textContent = ch;
        span.style.display = "inline-block";
        span.style.opacity = "0";
        span.style.transform = "translateY(8px)";
        if (ch === " ") span.style.width = "0.35em";
        titleRef.current!.appendChild(span);
        return span;
      });
      tl.to(chars, {
        opacity: 1,
        y: 0,
        duration: 0.04,
        stagger: 0.03,
        ease: "power2.out",
      }, 0.8);
    }

    tl.fromTo(dividerRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 0.5, ease: "power2.inOut" },
      1.5
    );

    tl.fromTo(subtitleRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4 },
      1.8
    );

    tl.fromTo(clerkRef.current,
      { opacity: 0, y: 20, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" },
      2.1
    );

    return () => { tl.kill(); };
  }, []);

  /* ── Scroll-triggered presentation animations ──── */
  useEffect(() => {
    if (!presentationRef.current) return;

    const ctx = gsap.context(() => {
      /* Animate each .pres-section */
      gsap.utils.toArray<HTMLElement>(".pres-section").forEach((sec) => {
        gsap.fromTo(sec,
          { opacity: 0, y: 60 },
          {
            opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
            scrollTrigger: { trigger: sec, start: "top 85%", once: true },
          }
        );
      });

      /* Stagger stack cards */
      gsap.utils.toArray<HTMLElement>(".stack-group").forEach((group) => {
        const cards = group.querySelectorAll(".stack-card");
        gsap.fromTo(cards,
          { opacity: 0, y: 30, scale: 0.97 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.5, stagger: 0.08, ease: "power2.out",
            scrollTrigger: { trigger: group, start: "top 85%", once: true },
          }
        );
      });

      /* Data-flow step reveals */
      gsap.utils.toArray<HTMLElement>(".flow-step").forEach((step, i) => {
        gsap.fromTo(step,
          { opacity: 0, x: i % 2 === 0 ? -40 : 40 },
          {
            opacity: 1, x: 0, duration: 0.7, ease: "power3.out",
            scrollTrigger: { trigger: step, start: "top 85%", once: true },
          }
        );
      });

      /* Connecting lines grow */
      gsap.utils.toArray<HTMLElement>(".flow-connector").forEach((line) => {
        gsap.fromTo(line,
          { scaleY: 0 },
          {
            scaleY: 1, duration: 0.5, ease: "power2.inOut",
            scrollTrigger: { trigger: line, start: "top 90%", once: true },
          }
        );
      });
    }, presentationRef);

    return () => ctx.revert();
  }, []);

  /* ── Scroll to top ─────────────────────────────── */
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      {/* ═════════════ HERO SECTION (ORIGINAL) ═════════════ */}
      <main className="flex min-h-screen items-center justify-center relative">
        <div className="shield-scanline" />

        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div ref={scanLine1} className="absolute inset-x-0 top-1/3 h-px origin-left bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-8" style={{ transform: "scaleX(0)" }} />
          <div ref={scanLine2} className="absolute inset-x-0 top-2/3 h-px origin-right bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-4" style={{ transform: "scaleX(0)" }} />
        </div>

        <div ref={containerRef} className="relative z-10 space-y-8 opacity-0">
          <div className="text-center">
            <img src="/logo.webp" alt="S.H.I.E.L.D." className="mx-auto mb-4 h-16 w-16 object-contain drop-shadow-[0_0_12px_rgba(45,212,191,0.3)]" />
            <span ref={microRef} className="shield-micro-label inline-block overflow-hidden whitespace-nowrap" style={{ width: 0, opacity: 0 }}>
              Strategic Homeland Intervention
            </span>
            <h1 ref={titleRef} className="shield-title shield-title-lg tracking-widest text-white">
              S.H.I.E.L.D. Command Center
            </h1>
            <div ref={dividerRef} className="shield-divider-accent mx-auto mt-3 w-48" style={{ transform: "scaleX(0)" }} />
            <p ref={subtitleRef} className="mt-3 font-mono text-xs tracking-wider text-[var(--text-muted)]" style={{ opacity: 0 }}>
              SECURE ACCESS TERMINAL
            </p>
          </div>

          <div ref={clerkRef} style={{ opacity: 0 }}>
            <SignIn routing="hash" forceRedirectUrl="/dashboard" />
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 animate-pulse">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)]">Scroll for briefing</span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="text-[var(--accent)]">
            <path d="M8 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </main>

      {/* ═════════════ PRESENTATION SECTIONS ═════════════ */}
      <div ref={presentationRef} className="relative z-10">

        {/* ── SYSTEM OVERVIEW: STACK ─────────────────── */}
        <section className="pres-section py-24 px-6 max-w-5xl mx-auto">
          <SectionLabel>System Overview</SectionLabel>
          <h2 className="shield-title text-2xl md:text-3xl text-center text-white mt-4 mb-2 tracking-[0.15em]">
            Technology Stack
          </h2>
          <p className="text-center font-mono text-xs text-[var(--text-muted)] tracking-wider mb-12 max-w-xl mx-auto">
            THE INFRASTRUCTURE POWERING THE COMMAND CENTER
          </p>

          <div className="space-y-8">
            {Object.entries(TECH_STACK).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                  <h3 className="shield-title shield-title-md tracking-widest">{category}</h3>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div className="stack-group flex flex-wrap gap-2">
                  {items.map((name) => (
                    <span
                      key={name}
                      className="stack-card rounded border border-[var(--accent-border)] bg-[var(--surface-1)] px-3 py-1.5 font-mono text-xs font-medium text-white tracking-wide hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors duration-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider ────────────────────────────────── */}
        <div className="shield-divider-accent mx-auto w-64" />

        {/* ── DATA FLOW ──────────────────────────────── */}
        <section className="pres-section py-24 px-6 max-w-4xl mx-auto">
          <SectionLabel>Intelligence Pipeline</SectionLabel>
          <h2 className="shield-title text-2xl md:text-3xl text-center text-white mt-4 mb-2 tracking-[0.15em]">
            Data Flow
          </h2>
          <p className="text-center font-mono text-xs text-[var(--text-muted)] tracking-wider mb-16 max-w-xl mx-auto">
            HOW DATA MOVES THROUGH THE SYSTEM
          </p>

          <div className="relative">
            {/* Vertical timeline spine */}
            <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--accent-border)] via-[var(--accent-border)] to-transparent" />

            <div className="space-y-0">
              {DATA_FLOW_STEPS.map((step, i) => (
                <div key={step.phase}>
                  {/* Step */}
                  <div className="flow-step relative pl-16 md:pl-20 py-8">
                    {/* Phase node */}
                    <div className="absolute left-[14px] md:left-[22px] top-10 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full border border-[var(--accent-border)] bg-[var(--surface-1)] flex items-center justify-center shadow-[0_0_12px_rgba(45,212,191,0.15)]">
                        <span className="font-mono text-[10px] font-bold text-[var(--accent)]">{step.phase}</span>
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="shield-panel p-6 relative overflow-hidden">
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[var(--accent-border)] via-transparent to-transparent" />

                      <h4 className="shield-title shield-title-md text-white tracking-widest mb-3">
                        {step.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-4">
                        {step.body}
                      </p>
                      <div className="inline-block rounded border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1">
                        <span className="font-mono text-[10px] font-medium tracking-wider text-[var(--accent)]">
                          {step.tag}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connector line between steps */}
                  {i < DATA_FLOW_STEPS.length - 1 && (
                    <div className="flow-connector origin-top ml-[22px] md:ml-[30px] w-px h-4 bg-[var(--accent-border)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────── */}
        <div className="shield-divider-accent mx-auto w-64" />

        {/* ── RETURN TO TOP ──────────────────────────── */}
        <section className="pres-section py-24 px-6 flex flex-col items-center gap-6">
          <img src="/logo.webp" alt="S.H.I.E.L.D." className="h-12 w-12 object-contain opacity-30" />
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--text-muted)] uppercase">
            End of Briefing
          </p>
          <button
            onClick={scrollToTop}
            className="shield-btn-primary flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 11V3m0 0L3 7m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Return to Top
          </button>
        </section>

        <div className="h-12" />
      </div>
    </>
  );
}
