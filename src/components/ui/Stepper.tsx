import { cn } from "@/lib/cn";

/** Horizontal progress indicator for the wizard. */
export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((label, index) => {
        const state =
          index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                state === "active" && "bg-brand-red text-white",
                state === "done" && "bg-ink text-white",
                state === "todo" && "bg-band text-ink-muted",
              )}
            >
              {state === "done" ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "text-[12px] font-bold tracking-wide uppercase",
                state === "todo" ? "text-ink-muted" : "text-ink",
              )}
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden className="mx-1 h-px w-5 bg-line sm:w-8" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
