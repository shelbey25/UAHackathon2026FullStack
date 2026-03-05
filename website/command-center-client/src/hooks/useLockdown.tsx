"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface LockdownContextValue {
  locked: boolean;
  /** Call this when any API returns 403. Idempotent. */
  triggerLockdown: () => void;
  /** Call this to clear lockdown (re-authorized). */
  clearLockdown: () => void;
}

const LockdownContext = createContext<LockdownContextValue>({
  locked: false,
  triggerLockdown: () => {},
  clearLockdown: () => {},
});

export function LockdownProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);

  const triggerLockdown = useCallback(() => {
    setLocked(true);
  }, []);

  const clearLockdown = useCallback(() => {
    setLocked(false);
  }, []);

  return (
    <LockdownContext.Provider value={{ locked, triggerLockdown, clearLockdown }}>
      {children}
    </LockdownContext.Provider>
  );
}

export function useLockdown() {
  return useContext(LockdownContext);
}
