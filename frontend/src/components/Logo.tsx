interface Props {
  size?: number;
  className?: string;
}

/**
 * App mark: two overlapping play-triangles converging into one inside a
 * rounded-square badge — evokes a music/video "play" motif while the
 * duplicate-triangle overlap nods to merging/deduping playlists. Deliberately
 * not YouTube's red/rectangle combination: square badge, indigo accent
 * (matches --accent), no wordmark.
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
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-hover)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-badge)" />
      <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="var(--bg)" strokeOpacity="0.15" />
      <polygon points="9,5 9,19 20,12" fill="var(--text)" fillOpacity="0.35" />
      <polygon points="14,9 14,23 25,16" fill="var(--text)" />
    </svg>
  );
}
