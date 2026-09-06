export type Theme = "dark" | "light";

const STORAGE_KEY = "ytmm-theme";

/** Reads the user's saved theme choice. Defaults to "dark" — this app has always been
 * dark-first; light is an opt-in, not a system-preference guess. */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts.
    return "dark";
  }
}

/**
 * Applies the theme by setting `data-theme` on the root element (index.css's `[data-theme]`
 * selectors key off this) and persists the choice. Called synchronously on module load (see
 * main.tsx) so the correct theme is set before the first paint, not flipped after mount.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persisting is best-effort; the app still works for this session without it.
  }
}
