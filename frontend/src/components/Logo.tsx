interface Props {
  size?: number;
  className?: string;
}

/**
 * App mark: two overlapping play-triangles converging into one inside a
 * rounded-square badge — evokes a music/video "play" motif while the
 * duplicate-triangle overlap nods to merging/deduping playlists. Deliberately
 * not YouTube's red/rectangle combination: square badge, indigo accent, no
 * wordmark.
 *
 * Colors are hardcoded rather than themed (`var(--accent)` etc.) on purpose:
 * the mark is the one piece of brand identity that should look identical in
 * both the light and dark theme (see src/theme.ts), the same way a real logo
 * doesn't recolor itself to match whatever page it sits on. Values below are
 * the dark theme's --accent/--accent-hover/--bg/--text as of when this was
 * fixed — if those tokens are ever redesigned, the logo intentionally does
 * not follow.
 */
export function Logo({ size = 28, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="YT Music Manager logo"
      className={className}
    >
      <defs>
        <linearGradient id="logo-badge" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6c8cff" />
          <stop offset="1" stopColor="#5677e6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-badge)" />
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="#0f1115" strokeOpacity="0.15" />
      <polygon points="9,5 9,19 20,12" fill="#e8eaed" fillOpacity="0.35" />
      <polygon points="14,9 14,23 25,16" fill="#e8eaed" />
    </svg>
  );
}
