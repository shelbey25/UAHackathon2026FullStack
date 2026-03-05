"use client";

import { useState, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";

interface JarvisResponse {
  sent: boolean;
  webhookStatus: number;
  instructions: string;
}

export function useJarvisSync() {
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInstructions(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;
      const res = await fetch(`${API_BASE_URL}/api/jarvis/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
        },
      });

      if (!res.ok) throw new Error(`J.A.R.V.I.S. sync failed: ${res.status}`);

      const data: JarvisResponse = await res.json();

      if (!data.sent) throw new Error("J.A.R.V.I.S. sync unsuccessful");

      setInstructions(data.instructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "J.A.R.V.I.S. sync failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInstructions(null);
    setError(null);
    setLoading(false);
  }, []);

  return { sync, loading, instructions, error, reset };
}
