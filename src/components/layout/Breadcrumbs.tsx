"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  ncr: "NCR",
  "api-docs": "API",
  new: "Raise NCR",
};

function labelFor(segment: string) {
  return (
    LABELS[segment] ??
    segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

/** Derived from the URL, so every new page gets breadcrumbs for free. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => ({
    label: labelFor(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    last: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <li>
          <Link href="/dashboard" className="text-ink-muted hover:text-brand-red">
            Home
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <span aria-hidden className="text-line">
              /
            </span>
            {crumb.last ? (
              <span className="font-semibold text-ink" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="text-ink-muted hover:text-brand-red">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
