"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  THEME_STORAGE_KEY,
  isThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Light / Dark / System, remembered per browser.
 *
 * Three options rather than two on purpose: a phone that switches to dark at
 * dusk should take the app with it, and "System" is the only way to say that.
 * It is also the default, so nobody has to choose before the app looks right.
 *
 * The choice is per device, not per account — someone on a bright shop floor
 * and the same person at a desk want different answers, and storing it against
 * the M1 user would give them one.
 */

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: string }> = [
  {
    value: "light",
    label: "Light",
    // Sun.
    icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  },
  {
    value: "dark",
    label: "Dark",
    // Crescent.
    icon: "M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z",
  },
  {
    value: "system",
    label: "System",
    // Monitor.
    icon: "M3 5h18v11H3zM8 20h8m-4-4v4",
  },
];

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeToggle({ className }: { className?: string }) {
  /**
   * Starts as "system" on both server and client so the markup matches;
   * the real choice is read after mount. The inline script in the layout has
   * already applied it to <html>, so there is no flash — only this control
   * briefly showing the default highlight.
   */
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeChoice(stored)) setChoice(stored);
    } catch {
      // Private windows can refuse storage; "system" is a fine answer.
    }
    setReady(true);
  }, []);

  function choose(next: ThemeChoice) {
    setChoice(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not remembered across reloads, but applied for this session.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border border-line bg-canvas p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = ready && choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => choose(option.value)}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-sm transition-colors",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d={option.icon} />
            </svg>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
