"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";
import { useLockdown } from "@/hooks/useLockdown";

export interface InventoryRecord {
  id: number;
  sector_id: string;
  resource_type: string;
  timestamp: string;
  stock_level: number;
  usage_rate_hourly: number;
  snap_event_detected: boolean;
  restock_amount: number;
  restock_reason: string;
}

interface UseInventoryOptions {
  sector?: string;
  resource?: string;
  days?: number;
}

export function useInventory(options: UseInventoryOptions = {}) {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { triggerLockdown } = useLockdown();
  const lastJsonRef = useRef<string>("");

  const fetchInventory = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }

    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (options.sector) params.set("sector", options.sector);
      if (options.resource) params.set("resource", options.resource);
      if (options.days) params.set("days", String(options.days));

      const qs = params.toString();
      const url = `${API_BASE_URL}/api/inventory${qs ? `?${qs}` : ""}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { triggerLockdown(); return; }
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: InventoryRecord[] = await res.json();
      const json = JSON.stringify(data);
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setRecords(data);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Failed to fetch inventory");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [options.sector, options.resource, options.days, getToken, triggerLockdown]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /* 5-second polling — silent, only updates state if data changed */
  useEffect(() => {
    const id = setInterval(() => fetchInventory(true), 5000);
    return () => clearInterval(id);
  }, [fetchInventory]);

  return { records, loading, error, refetch: fetchInventory };
}
