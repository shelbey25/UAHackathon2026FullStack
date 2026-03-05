"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";
import { useLockdown } from "@/hooks/useLockdown";

export interface ForecastResource {
  id: number;
  location: string;       // maps to sector_id
  resource: string;       // maps to resource_type
  depletionRate: number;  // slope (units lost per hour)
  lastUpdated: string;
}

export function useForecast() {
  const [forecasts, setForecasts] = useState<ForecastResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { triggerLockdown } = useLockdown();
  const lastJsonRef = useRef<string>("");

  const fetchForecasts = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/forecasting-front-end`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { triggerLockdown(); return; }
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: ForecastResource[] = await res.json();
      const json = JSON.stringify(data);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setForecasts(data);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Failed to fetch forecasts");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken, triggerLockdown]);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  /* 5-second polling — silent, only updates state if data changed */
  useEffect(() => {
    const id = setInterval(() => fetchForecasts(true), 5000);
    return () => clearInterval(id);
  }, [fetchForecasts]);

  return { forecasts, loading, error, refetch: fetchForecasts };
}
