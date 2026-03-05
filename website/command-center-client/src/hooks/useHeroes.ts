"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";
import { useLockdown } from "@/hooks/useLockdown";

/* ── Hero type matching Prisma model ──────────────── */
export interface Hero {
  id: number;
  hero_name: string;
  is_active: boolean;
  active_resource: string;
  active_location: string;
  assignment_start_time: string | null;
  assignment_end_time: string | null;
}

/* ── Assign payload ───────────────────────────────── */
export interface AssignPayload {
  hero_name: string;
  active_resource: string;
  active_location: string;
  duration_hours: number;
}

/* ── hook ──────────────────────────────────────────── */
export function useHeroes() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { triggerLockdown } = useLockdown();
  const lastJsonRef = useRef<string>("");
  const consecutiveErrorsRef = useRef(0);

  const fetchHeroes = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/hero`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { triggerLockdown(); return; }
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: Hero[] = await res.json();
      const json = JSON.stringify(data);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setHeroes(data);
      }
      consecutiveErrorsRef.current = 0; // reset on success
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      if (!silent) setError(err instanceof Error ? err.message : "Failed to fetch heroes");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken, triggerLockdown]);

  /* Initial fetch */
  useEffect(() => { fetchHeroes(); }, [fetchHeroes]);

  /* Polling — backs off on repeated errors (5s → 10s → 20s → 30s max) */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const backoff = Math.min(5000 * Math.pow(2, consecutiveErrorsRef.current), 30_000);
      timer = setTimeout(async () => {
        await fetchHeroes(true);
        schedule();
      }, backoff);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [fetchHeroes]);

  /* ── Assign a hero ──────────────────────────────── */
  const assignHero = useCallback(async (payload: AssignPayload) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE_URL}/api/hero/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "",
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 403) { triggerLockdown(); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `API error: ${res.status}`);
    }
    const data = await res.json();
    await fetchHeroes(true);
    return data;
  }, [getToken, triggerLockdown, fetchHeroes]);

  /* ── Unassign a hero ────────────────────────────── */
  const unassignHero = useCallback(async (hero_name: string) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE_URL}/api/hero/unassign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "",
      },
      body: JSON.stringify({ hero_name }),
    });
    if (res.status === 403) { triggerLockdown(); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `API error: ${res.status}`);
    }
    const data = await res.json();
    await fetchHeroes(true);
    return data;
  }, [getToken, triggerLockdown, fetchHeroes]);

  return { heroes, loading, error, refetch: fetchHeroes, assignHero, unassignHero };
}
