"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CONSENT_COOKIE } from "@/lib/auth/constants";

type Choice = "all" | "essential";

function writeConsent(choice: Choice) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${oneYear}; samesite=lax`;
}

/**
 * Cookie notice. The session cookie is strictly necessary and always set;
 * this records the user's choice on anything optional (analytics later).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
    setVisible(!stored);
  }, []);

  /**
   * The banner is fixed to the bottom, so without this it sits on top of
   * whatever is down there — buttons included — and swallows their clicks.
   * Its height is published as a CSS variable, and the app shell turns that
   * into padding *inside* the scrolling content, which is the only place that
   * actually creates room to scroll past it.
   */
  useEffect(() => {
    const root = document.documentElement;

    if (!visible) {
      root.style.removeProperty("--cookie-banner-height");
      return;
    }

    const banner = bannerRef.current;
    if (!banner) return;

    const apply = () =>
      root.style.setProperty("--cookie-banner-height", `${banner.offsetHeight}px`);
    apply();

    // Height changes when the text wraps at narrow widths.
    const observer = new ResizeObserver(apply);
    observer.observe(banner);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--cookie-banner-height");
    };
  }, [visible]);

  if (!visible) return null;

  function choose(choice: Choice) {
    writeConsent(choice);
    setVisible(false);
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 py-3 shadow-[0_-4px_20px_rgba(27,30,33,0.10)] sm:py-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Short on a phone, where this banner costs a sixth of the screen. */}
        <p className="text-[13px] text-ink-body">
          <span className="sm:hidden">
            We use a cookie to keep you signed in.
          </span>
          <span className="hidden sm:inline">
            We use a strictly necessary cookie to keep you signed in. Optional
            cookies help us understand how the tool is used — your choice is
            remembered for a year.
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button size="sm" onClick={() => choose("all")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
