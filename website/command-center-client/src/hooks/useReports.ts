"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";
import { useLockdown } from "@/hooks/useLockdown";

/* ── types matching Prisma models ─────────────────── */

export type Priority = "ROUTINE" | "HIGH" | "URGENT" | "CRITICAL" | "AVENGERS_LEVEL_THREAT";

export interface ProcessedReport {
  id: number;
  reportId: number;
  redactedText: string;
  timestamp: string;
  resource_name: string;
  resource_level: string;
  location: string;
  priority: Priority;
  cleared: boolean;
  processedAt: string;
}

export interface RawReport {
  id: number;
  report_id: string;
  heroAlias: string | null;
  secure_contact: string | null;
  receivedAt: string;
  rawText: string;
  priority: Priority;
  ProcessedReport: ProcessedReport | null;
}

export interface ReportsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/* ── hook params ──────────────────────────────────── */

export interface UseReportsParams {
  page?: number;
  limit?: number;
  priority?: string;   // "ALL" or a Priority value
  cleared?: boolean | null; // null = no filter, true = cleared, false = not cleared
}

/* ── hook ──────────────────────────────────────────── */

export function useReports(params: UseReportsParams = {}) {
  const { page = 1, limit = 20, priority, cleared } = params;

  const [reports, setReports] = useState<RawReport[]>([]);
  const [meta, setMeta] = useState<ReportsMeta>({
    page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { triggerLockdown } = useLockdown();
  const lastJsonRef = useRef<string>("");

  /* Stable ref for the latest params so the callback never goes stale */
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchReports = useCallback(async (silent = false) => {
    const { page: pg = 1, limit: lm = 20, priority: pr, cleared: cl } = paramsRef.current;
    if (!silent) { setLoading(true); setError(null); }
    try {
      const token = await getToken();
      const qs = new URLSearchParams();
      qs.set("page", String(pg));
      qs.set("limit", String(lm));
      if (pr && pr !== "ALL") qs.set("priority", pr);
      if (cl !== null && cl !== undefined) qs.set("cleared", String(cl));

      const res = await fetch(`${API_BASE_URL}/api/reports?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { triggerLockdown(); return; }
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      const serialized = JSON.stringify(json);
      if (serialized !== lastJsonRef.current) {
        lastJsonRef.current = serialized;
        setReports(json.data as RawReport[]);
        setMeta(json.meta as ReportsMeta);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Failed to fetch reports");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken, triggerLockdown]); // stable — reads from ref

  /* Re-fetch whenever filter params change */
  useEffect(() => {
    fetchReports();
  }, [fetchReports, page, limit, priority, cleared]);

  /* 5-second polling — silent, only updates state if data changed */
  useEffect(() => {
    const id = setInterval(() => fetchReports(true), 5000);
    return () => clearInterval(id);
  }, [fetchReports]);

  return { reports, meta, loading, error, refetch: fetchReports };
}
