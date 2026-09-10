import { APP_NAME, versionLabel } from "@/lib/version";

/**
 * Appears on every page, signed in or not.
 *
 * It carries the build alongside the wordmark on purpose: the first question
 * asked of any UAT report is which version it came from, and a footer is the
 * one place a person can always find without being told where to look.
 */
export function Footer() {
  return (
    <footer className="border-t border-line px-4 py-5 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 text-[12px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          This is a <span className="font-bold text-ink-body">remax DOORS</span>{" "}
          product.
        </p>
        <p className="tabular-nums">
          {APP_NAME} {versionLabel()}
        </p>
      </div>
    </footer>
  );
}
