import { useEffect, useRef, useState } from "react";

interface Props {
  channelTitle?: string;
  onLogout: () => void;
}

/**
 * The "who am I / sign out" corner of the app. Single-account tool (see docs/ARCHITECTURE.md —
 * no multi-user auth), so this is deliberately just an avatar + name that opens a small menu
 * with one action — not an account switcher. Built as a real menu (open/close state,
 * click-outside, Escape, ARIA menu semantics) since a visual redesign is expected to land on
 * top of this soon and will want a solid structure to restyle rather than a one-off dropdown.
 */
export function AccountMenu({ channelTitle, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = channelTitle ? channelTitle.trim().charAt(0).toUpperCase() : "?";

  function handleLogoutClick() {
    setOpen(false);
    onLogout();
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="account-menu__name">{channelTitle ?? "Signed in"}</span>
      </button>
      {open && (
        <div className="account-menu__dropdown" role="menu">
          <button
            type="button"
            className="account-menu__item"
            role="menuitem"
            onClick={handleLogoutClick}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
