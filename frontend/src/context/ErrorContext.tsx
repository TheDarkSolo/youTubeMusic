import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../api/client";

export interface Banner {
  id: number;
  message: string;
  code: string;
  retryable: boolean;
}

const QUOTA_COOLDOWN_MS = 60_000;

interface ErrorContextValue {
  banners: Banner[];
  /** Report any error. Returns the ApiError code if it was one, else undefined. */
  reportError: (err: unknown) => string | undefined;
  dismiss: (id: number) => void;
  /** True while a recent 429 QUOTA_EXCEEDED should keep retry actions disabled. */
  quotaCoolingDown: boolean;
  quotaCooldownRemainingMs: number;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

let nextId = 1;

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [quotaCooldownUntil, setQuotaCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const dismiss = useCallback((id: number) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const reportError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    const code = err instanceof ApiError ? err.code : "UNKNOWN_ERROR";
    const retryable = err instanceof ApiError ? err.retryable : false;

    const id = nextId++;
    setBanners((prev) => [...prev, { id, message, code, retryable }]);

    if (code === "QUOTA_EXCEEDED") {
      const until = Date.now() + QUOTA_COOLDOWN_MS;
      setQuotaCooldownUntil(until);
      // Re-render once the cooldown lapses so `quotaCoolingDown` flips back off.
      setTimeout(() => forceTick((t) => t + 1), QUOTA_COOLDOWN_MS + 50);
    }

    return code;
  }, []);

  const quotaCoolingDown = quotaCooldownUntil !== null && Date.now() < quotaCooldownUntil;
  const quotaCooldownRemainingMs = quotaCoolingDown ? quotaCooldownUntil! - Date.now() : 0;

  const value = useMemo(
    () => ({ banners, reportError, dismiss, quotaCoolingDown, quotaCooldownRemainingMs }),
    [banners, reportError, dismiss, quotaCoolingDown, quotaCooldownRemainingMs],
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function useErrors(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error("useErrors must be used within an ErrorProvider");
  return ctx;
}
