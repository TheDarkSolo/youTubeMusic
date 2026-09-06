import { useTheme } from "../hooks/useTheme";

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <line x1="8" y1="0.8" x2="8" y2="2.4" />
        <line x1="8" y1="13.6" x2="8" y2="15.2" />
        <line x1="0.8" y1="8" x2="2.4" y2="8" />
        <line x1="13.6" y1="8" x2="15.2" y2="8" />
        <line x1="2.7" y1="2.7" x2="3.8" y2="3.8" />
        <line x1="12.2" y1="12.2" x2="13.3" y2="13.3" />
        <line x1="2.7" y1="13.3" x2="3.8" y2="12.2" />
        <line x1="12.2" y1="3.8" x2="13.3" y2="2.7" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M13.8 10.2A6 6 0 0 1 5.8 2.2a6.3 6.3 0 1 0 8 8z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Switches the `data-theme` attribute (see theme.ts) and remembers the choice. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      className="btn btn--tertiary btn--small btn--theme"
      onClick={toggleTheme}
      title={nextLabel}
      aria-label={nextLabel}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
