"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";

/**
 * Ensures the currently signed-in Clerk user exists in the backend database.
 * Safe to call on every mount — the backend returns 409 if the user already
 * exists, which we silently ignore.
 */
export function useSyncUser() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || synced.current) return;

    (async () => {
      try {
        const token = await getToken();

        await fetch(`${API_BASE_URL}/api/users/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName || user.firstName || "Unknown",
            phone: user.primaryPhoneNumber?.phoneNumber || "",
          }),
        });

        synced.current = true;
      } catch {
        // ignore — user may already exist or network hiccup
      }
    })();
  }, [isSignedIn, user, getToken]);
}
