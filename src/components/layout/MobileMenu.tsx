"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { navItems } from "@/config/nav";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Hamburger nav for small screens: sections plus the page-level actions. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  // Any navigation closes the sheet.
  useEffect(() => setOpen(false), [pathname]);

  // Lock the page behind the sheet while it is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 top-[57px] z-30 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-[57px] z-40 border-b border-line bg-surface p-4 shadow-lg"
          >
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-semibold",
                      active
                        ? "bg-band text-ink"
                        : "text-ink-muted hover:bg-canvas",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 grid gap-2 border-t border-line pt-3">
              <Button
                variant="secondary"
                onClick={() => startRefresh(() => router.refresh())}
                disabled={refreshing}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cn("h-4 w-4", refreshing && "animate-spin")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
                </svg>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Link href="/ncr/new" className="block">
                <Button className="w-full">Add NCR</Button>
              </Link>
              <Link href="/api/auth/logout" className="block">
                <Button variant="ghost" className="w-full">
                  Sign out
                </Button>
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
