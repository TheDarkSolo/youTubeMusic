import { useErrors } from "../context/ErrorContext";

/** Stack of dismissible toast banners for any error reported via useErrors(). */
export function ErrorBanners() {
  const { banners, dismiss } = useErrors();
  if (banners.length === 0) return null;

  return (
    <div className="banner-stack" role="region" aria-label="Errors">
      {banners.map((b) => (
        <div key={b.id} className={`banner banner--${b.code === "QUOTA_EXCEEDED" ? "warn" : "error"}`}>
          <span className="banner__message">{b.message}</span>
          <button className="banner__dismiss" onClick={() => dismiss(b.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
