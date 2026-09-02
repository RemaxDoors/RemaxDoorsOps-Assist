"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Asks whether to keep going after a spell of inactivity.
 *
 * Half-finished NCRs left open on a shop-floor PC are the problem this solves:
 * the next person finds someone else's draft and either adds to it or loses
 * it. After the idle window the draft is still there — nothing is discarded
 * without an answer — but continuing is now a deliberate choice.
 */
export function IdlePrompt({
  idleMs = 5 * 60_000,
  onContinue,
  onRestart,
  label = "this NCR",
}: {
  idleMs?: number;
  onContinue?: () => void;
  onRestart: () => void;
  label?: string;
}) {
  const [prompting, setPrompting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPrompting(true), idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (prompting) return; // Stop rearming once the question is on screen.

    const activity = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const reset = () => startTimer();

    for (const event of activity) {
      window.addEventListener(event, reset, { passive: true });
    }
    startTimer();

    return () => {
      for (const event of activity) window.removeEventListener(event, reset);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [prompting, startTimer]);

  if (!prompting) return null;

  const minutes = Math.round(idleMs / 60_000);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-sm border border-line bg-surface p-5 shadow-xl">
        <h2 id="idle-title" className="text-[15px] font-bold text-ink">
          Still working on {label}?
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-body">
          Nothing has happened for {minutes} minutes. Your entries are still
          here — carry on, or clear the form and start again.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setPrompting(false);
              onContinue?.();
            }}
          >
            Continue
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setPrompting(false);
              onRestart();
            }}
          >
            Start again
          </Button>
        </div>
      </div>
    </div>
  );
}
