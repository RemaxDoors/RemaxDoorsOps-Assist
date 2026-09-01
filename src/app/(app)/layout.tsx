import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireSession } from "@/lib/auth/session";

/** Every route in this group requires a signed-in user. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
