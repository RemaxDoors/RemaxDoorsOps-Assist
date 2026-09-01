import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Session } from "@/lib/auth/session";

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} />
        <main
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-7"
          // Keeps content clear of the fixed cookie banner while it is shown.
          style={{ paddingBottom: "calc(1.5rem + var(--cookie-banner-height, 0px))" }}
        >
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
