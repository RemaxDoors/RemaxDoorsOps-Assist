"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/config/nav";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="px-5 py-5">
        <Logo width={140} />
        <p className="mt-2 text-[10px] font-bold tracking-[0.18em] text-ink-muted uppercase">
          Operation Help
        </p>
      </div>
      <div className="px-3 pb-2">
        <Link href="/ncr/new" className="block">
          <Button className="w-full">Add NCR</Button>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-bold tracking-wide uppercase transition-colors",
                active
                  ? "bg-band text-ink"
                  : "text-ink-body hover:bg-canvas hover:text-ink",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={item.icon} />
              </svg>
              {item.label}
              {active ? (
                <span className="ml-auto h-4 w-[3px] bg-brand-red" />
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[11px] text-ink-muted">Ops Assist v0.1</div>
    </aside>
  );
}
