import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "graphite"
  | "brand"
  | "ok"
  | "warn"
  | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-muted border-line",
  graphite: "bg-band text-ink border-line",
  brand: "bg-brand-red-soft text-brand-red-dark border-brand-red/25",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
