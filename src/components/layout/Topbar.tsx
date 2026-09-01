import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import type { Session } from "@/lib/auth/session";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar({ session }: { session: Session }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <MobileMenu />
          <div className="md:hidden">
            <Logo width={112} />
          </div>
          <span className="hidden text-[13px] text-ink-muted md:inline">
            Operations workspace
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-semibold text-ink">{session.name}</div>
            <Link
              href="/api/auth/logout"
              className="text-[11px] text-ink-muted hover:text-brand-red"
            >
              Sign out
            </Link>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">
            {initials(session.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
