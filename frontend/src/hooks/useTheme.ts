import { useCallback, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../theme";

/** Current theme + a toggle, backed by the `data-theme` attribute set in theme.ts/main.tsx. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
